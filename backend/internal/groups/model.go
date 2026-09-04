package groups

import "time"

type Group struct {
	ID          int       `db:"id"`
	CreatorID   int       `db:"creator_id"`
	Title       string    `db:"title"`
	Description string    `db:"description"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

type GroupMember struct {
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
	ID            int       `db:"id"`
	GroupID       int       `db:"group_id"`
	InvitedBy     int       `db:"invited_by"`
	InvitedUserID int       `db:"invited_user_id"`
	Status        string    `db:"status"`
	CreatedAt     time.Time `db:"created_at"`
	UpdatedAt     time.Time `db:"updated_at"`
}

type GroupJoinRequest struct {
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
	ID          int    `json:"id"`
	CreatorID   int    `json:"creator_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
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
	Success  bool   `json:"success"`
	Message  string `json:"message,omitempty"`
	IsMember bool   `json:"is_member"`
	Role     string `json:"role,omitempty"`
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
	ID            int    `json:"id"`
	GroupID       int    `json:"group_id"`
	InvitedBy     int    `json:"invited_by"`
	InvitedUserID int    `json:"invited_user_id"`
	Status        string `json:"status"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

type GetGroupInvitationsResponse struct {
	Success     bool                      `json:"success"`
	Message     string                    `json:"message,omitempty"`
	Invitations []GroupInvitationResponse `json:"invitations,omitempty"`
}

type Handler struct {
	service *Service
}
