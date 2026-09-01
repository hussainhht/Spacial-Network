// WebSocket Event Types (matching backend events)
export type EventType =
  | "user_online"
  | "user_offline"
  | "online_users"
  | "private_message"
  | "typing"
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
  sendMessage: (recipientID: number, content: string) => void;
  sendTyping: (recipientID: number, isTyping: boolean) => void;
}
