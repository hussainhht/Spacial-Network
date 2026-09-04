package groups

import "errors"

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{
		repo: repo,
	}
}

// CreateGroup stores a new group owned by creatorID and returns its ID.
func (s *Service) CreateGroup(creatorID int, title, description string) (int64, error) {
	return s.repo.InsertGroup(creatorID, title, description)
}

// GetAllGroups returns a page of groups, most recently created first.
func (s *Service) GetAllGroups(limit, offset int) ([]Group, error) {
	return s.repo.GetAllGroups(limit, offset)
}

// GetGroupByID returns the group with the given ID.
func (s *Service) GetGroupByID(id int) (*Group, error) {
	return s.repo.GetGroupByID(id)
}

// GetGroupMembers returns the members of a group, or ErrGroupNotFound if the
// group doesn't exist.
func (s *Service) GetGroupMembers(groupID int) ([]GroupMember, error) {
	if _, err := s.repo.GetGroupByID(groupID); err != nil {
		return nil, err
	}
	return s.repo.GetGroupMembers(groupID)
}

func (s *Service) IsGroupMember(groupID, userID int) (bool, error) {
	member, err := s.repo.GetMembership(groupID, userID)
	if err != nil {
		return false, err
	}
	return member != nil, nil
}

func (s *Service) GetMembership(groupID, userID int) (*GroupMember, error) {
	if _, err := s.repo.GetGroupByID(groupID); err != nil {
		return nil, err
	}
	return s.repo.GetMembership(groupID, userID)
}

func (s *Service) IsGroupCreator(groupID, userID int) (bool, error) {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		if errors.Is(err, ErrGroupNotFound) {
			return false, nil
		}
		return false, err
	}
	return group.CreatorID == userID, nil
}

func (s *Service) AddMember(groupID, userID int) error {
	if _, err := s.repo.GetGroupByID(groupID); err != nil {
		return err
	}
	return s.repo.AddMember(groupID, userID)
}


func (s *Service) RequestToJoin(groupID, userID int) error {
	if _, err := s.repo.GetGroupByID(groupID); err != nil {
		return err
	}

	member, err := s.repo.GetMembership(groupID, userID)
	if err != nil {
		return err
	}
	if member != nil {
		return ErrAlreadyMember
	}

	pending, err := s.repo.HasPendingJoinRequest(groupID, userID)
	if err != nil {
		return err
	}
	if pending {
		return ErrJoinRequestAlreadyPending
	}

	_, err = s.repo.CreateGroupJoinRequest(groupID, userID)
	return err
}


func (s *Service) GetPendingJoinRequests(groupID, creatorID int) ([]GroupJoinRequest, error) {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return nil, err
	}
	if group.CreatorID != creatorID {
		return nil, ErrNotGroupCreator
	}

	return s.repo.GetPendingJoinRequestsByGroup(groupID)
}


func (s *Service) AcceptJoinRequest(groupID, requestID, creatorID int) error {
	req, err := s.resolvePendingJoinRequest(groupID, requestID, creatorID)
	if err != nil {
		return err
	}

	if err := s.repo.AddMember(groupID, req.UserID); err != nil && !errors.Is(err, ErrAlreadyMember) {
		return err
	}

	return s.repo.UpdateJoinRequestStatus(requestID, StatusAccepted)
}


func (s *Service) RejectJoinRequest(groupID, requestID, creatorID int) error {
	if _, err := s.resolvePendingJoinRequest(groupID, requestID, creatorID); err != nil {
		return err
	}

	return s.repo.UpdateJoinRequestStatus(requestID, StatusDeclined)
}


func (s *Service) resolvePendingJoinRequest(groupID, requestID, creatorID int) (*GroupJoinRequest, error) {
	group, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return nil, err
	}
	if group.CreatorID != creatorID {
		return nil, ErrNotGroupCreator
	}

	req, err := s.repo.GetGroupJoinRequestByID(requestID)
	if err != nil {
		return nil, err
	}
	if req.GroupID != groupID {
		return nil, ErrJoinRequestNotFound
	}
	if req.Status != StatusPending {
		return nil, ErrJoinRequestNotPending
	}

	return req, nil
}


func (s *Service) CreateGroupInvitation(groupID, inviterID, invitedUserID int) error {
	if _, err := s.repo.GetGroupByID(groupID); err != nil {
		return err
	}

	if inviterID == invitedUserID {
		return ErrCannotInviteSelf
	}

	inviter, err := s.repo.GetMembership(groupID, inviterID)
	if err != nil {
		return err
	}
	if inviter == nil {
		return ErrNotGroupMember
	}

	invited, err := s.repo.GetMembership(groupID, invitedUserID)
	if err != nil {
		return err
	}
	if invited != nil {
		return ErrAlreadyMember
	}

	pending, err := s.repo.HasPendingInvitation(groupID, invitedUserID)
	if err != nil {
		return err
	}
	if pending {
		return ErrInvitationAlreadyPending
	}

	_, err = s.repo.CreateGroupInvitation(groupID, inviterID, invitedUserID)
	return err
}

func (s *Service) GetPendingInvitations(userID int) ([]GroupInvitation, error) {
	return s.repo.GetPendingInvitationsByUser(userID)
}


func (s *Service) AcceptGroupInvitation(invitationID, userID int) error {
	inv, err := s.resolvePendingInvitation(invitationID, userID)
	if err != nil {
		return err
	}

	if err := s.repo.AddMember(inv.GroupID, userID); err != nil && !errors.Is(err, ErrAlreadyMember) {
		return err
	}

	return s.repo.UpdateInvitationStatus(invitationID, StatusAccepted)
}

func (s *Service) DeclineGroupInvitation(invitationID, userID int) error {
	if _, err := s.resolvePendingInvitation(invitationID, userID); err != nil {
		return err
	}

	return s.repo.UpdateInvitationStatus(invitationID, StatusDeclined)
}


func (s *Service) resolvePendingInvitation(invitationID, userID int) (*GroupInvitation, error) {
	inv, err := s.repo.GetGroupInvitationByID(invitationID)
	if err != nil {
		return nil, err
	}
	if inv.InvitedUserID != userID {
		return nil, ErrInvitationNotFound
	}
	if inv.Status != StatusPending {
		return nil, ErrInvitationNotPending
	}

	return inv, nil
}
