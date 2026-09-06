package groups

import "time"

type Group struct {
	CreatorUsername       string
	MemberCount           int
	MembershipRole        string
	HasPendingJoinRequest bool
	HasPendingInvitation  bool
	ID                    int       `db:"id"`
	CreatorID             int       `db:"creator_id"`
	Title                 string    `db:"title"`
	Description           string    `db:"description"`
	CreatedAt             time.Time `db:"created_at"`
	UpdatedAt             time.Time `db:"updated_at"`
}

type GroupMember struct {
	Avatar   string    `json:"avatar,omitempty"`
	UserID   int       `db:"user_id"`
	Username string    `db:"username"`
	Role     string    `db:"role"`
	JoinedAt time.Time `db:"joined_at"`
}

// Status values shared by group_invitations and group_join_requests.
const (
	StatusPending  = "pending"
	StatusAccepted = "accepted"
	StatusDeclined = "declined"
)

type GroupInvitation struct {
	GroupTitle      string    `json:"group_title"`
	InviterUsername string    `json:"inviter_username"`
	ID              int       `db:"id"`
	GroupID         int       `db:"group_id"`
	InvitedBy       int       `db:"invited_by"`
	InvitedUserID   int       `db:"invited_user_id"`
	Status          string    `db:"status"`
	CreatedAt       time.Time `db:"created_at"`
	UpdatedAt       time.Time `db:"updated_at"`
}

// InviteCandidate is a user who can be shown as a match when a group member
// searches for someone to invite.
type InviteCandidate struct {
	ID           int    `db:"id"`
	Username     string `db:"username"`
	FirstName    string `db:"first_name"`
	LastName     string `db:"last_name"`
	ProfilePhoto string `db:"profile_photo"`
}

type GroupJoinRequest struct {
	Username  string    `json:"username"`
	ID        int       `db:"id"`
	GroupID   int       `db:"group_id"`
	UserID    int       `db:"user_id"`
	Status    string    `db:"status"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

type CreateGroupRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type CreateGroupResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	GroupID int64  `json:"group_id,omitempty"`
}

type GroupResponse struct {
	CreatorUsername       string `json:"creator_username"`
	MemberCount           int    `json:"member_count"`
	MembershipRole        string `json:"membership_role,omitempty"`
	HasPendingJoinRequest bool   `json:"has_pending_join_request"`
	HasPendingInvitation  bool   `json:"has_pending_invitation"`
	ID                    int    `json:"id"`
	CreatorID             int    `json:"creator_id"`
	Title                 string `json:"title"`
	Description           string `json:"description"`
	CreatedAt             string `json:"created_at"`
	UpdatedAt             string `json:"updated_at"`
}

type ListGroupsResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message,omitempty"`
	Groups  []GroupResponse `json:"groups,omitempty"`
}

type GetGroupResponse struct {
	Success bool           `json:"success"`
	Message string         `json:"message,omitempty"`
	Group   *GroupResponse `json:"group,omitempty"`
}

type GroupMemberResponse struct {
	Avatar   string `json:"avatar,omitempty"`
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	JoinedAt string `json:"joined_at"`
}

type GetGroupMembersResponse struct {
	Success bool                  `json:"success"`
	Message string                `json:"message,omitempty"`
	Members []GroupMemberResponse `json:"members,omitempty"`
}

type MembershipResponse struct {
	HasPendingJoinRequest bool   `json:"has_pending_join_request"`
	Success               bool   `json:"success"`
	Message               string `json:"message,omitempty"`
	IsMember              bool   `json:"is_member"`
	Role                  string `json:"role,omitempty"`
}

// ActionResponse is a generic success/message envelope for endpoints that
// perform an action but don't return any data (e.g. accept/reject/decline).
type ActionResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type CreateJoinRequestResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type GroupJoinRequestResponse struct {
	Username  string `json:"username"`
	ID        int    `json:"id"`
	GroupID   int    `json:"group_id"`
	UserID    int    `json:"user_id"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type GetJoinRequestsResponse struct {
	Success      bool                       `json:"success"`
	Message      string                     `json:"message,omitempty"`
	JoinRequests []GroupJoinRequestResponse `json:"join_requests,omitempty"`
}

type CreateGroupInvitationRequest struct {
	InvitedUserID int `json:"invited_user_id"`
}

type CreateGroupInvitationResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type GroupInvitationResponse struct {
	GroupTitle      string `json:"group_title"`
	InviterUsername string `json:"inviter_username"`
	ID              int    `json:"id"`
	GroupID         int    `json:"group_id"`
	InvitedBy       int    `json:"invited_by"`
	InvitedUserID   int    `json:"invited_user_id"`
	Status          string `json:"status"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
}

type GetGroupInvitationsResponse struct {
	Success     bool                      `json:"success"`
	Message     string                    `json:"message,omitempty"`
	Invitations []GroupInvitationResponse `json:"invitations,omitempty"`
}

// InviteCandidateResponse is one user returned by the invite-candidate
// search endpoint.
type InviteCandidateResponse struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Avatar    string `json:"avatar,omitempty"`
}

type Handler struct {
	service *Service
}
