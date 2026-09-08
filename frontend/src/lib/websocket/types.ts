export type EventType =
  | "user_online"
  | "user_offline"
  | "online_users"
  | "private_message"
  | "typing"
  | "mark_read"
  | "messages_read"
  | "invite_user_search"
  | "invite_user_search_results"
  | "error"
  | "notification"
  | "group_event_response_updated";

export interface WSEvent<T = unknown> {
  type: EventType;
  payload: T;
}

export interface MessagePayload {
  id?: number;
  sender_id: number;
  recipient_id: number;
  content: string;
  created_at?: string;
}

export interface TypingPayload {
  sender_id: number;
  recipient_id: number;
  is_typing: boolean;
}

export interface MarkReadPayload {
  sender_id: number;
}

export interface MessagesReadPayload {
  reader_id: number;
  sender_id: number;
  read_at: string;
}

export interface UserStatusPayload {
  user_id: number;
  is_online: boolean;
}

export interface OnlineUsersPayload {
  user_ids: number[];
}

export interface ErrorPayload {
  message: string;
}

export interface InviteUserSearchPayload {
  request_id: string;
  group_id: number;
  query: string;
  limit?: number;
}

export interface InviteSearchResultUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  avatar?: string;
}

export interface InviteUserSearchResultsPayload {
  request_id: string;
  group_id: number;
  users: InviteSearchResultUser[];
}

// NotificationEventPayload mirrors the "notification" websocket event's
// payload exactly as sent by the backend (see
// backend/internal/notifications/{model,events}.go) - both REST and
// WebSocket serialize the same generic Notification struct, so this one
// type covers both transports. `type` is left as a plain string and `data`
// as unknown here since this file has no notion of which notification types
// the UI currently supports, or their feature-specific data shape - that
// filtering/typing happens in the notifications feature, not at the
// transport layer.
export interface NotificationEventPayload {
  id: number;
  actor_id?: number;
  type: string;
  entity_type?: string;
  entity_id?: number;
  message: string;
  data?: unknown;
  read_at?: string | null;
  created_at: string;
}

// GroupEventResponseUpdatedPayload mirrors the "group_event_response_updated"
// websocket event the backend broadcasts after a group event RSVP
// (Going/Not Going) is persisted — see
// backend/internal/groups/event_ws.go. It's kept separate from
// NotificationEventPayload on purpose: an RSVP change is ephemeral realtime
// sync for one Event card, not a persisted, per-user notification.
export interface GroupEventResponseUpdatedPayload {
  group_id: number;
  event_id: number;
  user_id: number;
  response: "going" | "not_going";
}

export interface WebSocketContextType {
  isConnected: boolean;
  onlineUserIDs: number[];
  lastMessage: MessagePayload | null;
  typingStatus: TypingPayload | null;
  lastReadReceipt: MessagesReadPayload | null;
  errorMessage: string | null;
  inviteSearchResults: InviteUserSearchResultsPayload | null;
  lastNotification: NotificationEventPayload | null;
  lastEventResponseUpdate: GroupEventResponseUpdatedPayload | null;
  subscribeEventResponses: (listener: (event: GroupEventResponseUpdatedPayload) => void) => () => void;
  subscribeNotifications: (
    listener: (notification: NotificationEventPayload) => void,
  ) => () => void;
  sendEvent: (type: EventType, payload: unknown) => void;
}
