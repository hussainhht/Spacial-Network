export interface ConversationSummary {
  partner_id: number;
  partner_username: string;
  partner_first_name: string;
  partner_last_name: string;
  partner_avatar?: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export interface PrivateMessage {
  id: number;
  sender_id: number;
  recipient_id: number;
  content: string;
  created_at: string;
  read_at?: string;
}

export interface ChatHistoryParams {
  userId: number;
  limit?: number;
  offset?: number;
}
