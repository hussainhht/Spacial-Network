package share

// Share targets - where the post link is delivered. A share is always
// in-site: it becomes an ordinary chat message, never an outbound link to
// an external service.
const (
	// TargetUser sends the post link as a direct message.
	TargetUser = "user"
	// TargetGroup sends the post link to a group chat.
	TargetGroup = "group"
)

// ShareRequest is the JSON body accepted by the share endpoint: which
// post, where to send it, and an optional note from the sender.
type ShareRequest struct {
	// Target is TargetUser or TargetGroup.
	Target string `json:"target"`
	// TargetID is the recipient user's id when Target is TargetUser, or
	// the group's id when Target is TargetGroup.
	TargetID int64 `json:"target_id"`
	// Message is an optional note prepended to the shared link.
	Message string `json:"message,omitempty"`
}

// share is the message a share resolves to before it is handed to chat:
// the sender, where it goes, and the rendered message body.
type share struct {
	SenderID int64
	Target   string
	TargetID int64
	Content  string
}
