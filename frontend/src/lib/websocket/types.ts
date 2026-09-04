export type EventType =
  | "user_online"
  | "user_offline"
  | "online_users"
  | "private_message"
  | "typing"
  | "error"
  | "invite_user_search"
  | "invite_user_search_results";

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

export interface WebSocketContextType {
  isConnected: boolean;
  onlineUserIDs: number[];
  lastMessage: MessagePayload | null;
  typingStatus: TypingPayload | null;
  errorMessage: string | null;
  inviteSearchResults: InviteUserSearchResultsPayload | null;
  sendEvent: (type: EventType, payload: unknown) => void;
}
