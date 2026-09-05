export type EventType =
  | "user_online"
  | "user_offline"
  | "online_users"
  | "private_message"
  | "typing"
  | "mark_read"
  | "messages_read"
  | "error";

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

export interface WebSocketContextType {
  isConnected: boolean;
  onlineUserIDs: number[];
  lastMessage: MessagePayload | null;
  typingStatus: TypingPayload | null;
  lastReadReceipt: MessagesReadPayload | null;
  errorMessage: string | null;
  sendEvent: (type: EventType, payload: unknown) => void;
}
