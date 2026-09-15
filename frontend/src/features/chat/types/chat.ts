export interface ConversationSummary {
  partner_id: number;
  partner_username: string;
  partner_first_name: string;
  partner_last_name: string;
  partner_avatar?: string;
  last_message: string;
  last_message_at: string;
  last_message_from_me: boolean;
  unread_count: number;
}

export interface EligibleContact {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  profile_photo?: string;
}

export interface PrivateMessage {
  id: number;
  sender_id: number;
  recipient_id: number;
  sender_username?: string;
  sender_first_name?: string;
  sender_last_name?: string;
  sender_avatar?: string;
  content: string;
  created_at: string;
  read_at?: string;
}

export interface ChatHistoryParams {
  userId: number;
  limit?: number;
  offset?: number;
}

export interface ChatSidebarProps {
  conversations: ConversationSummary[];
  activeUserId: number | null;
  onlineUserIDs: number[];
  loading: boolean;
  onSelectConversation: (partnerId: number, partnerUsername: string, partnerAvatar?: string) => void;
}

export interface ChatWindowProps {
  partnerUsername: string;
  partnerAvatar?: string;
  isPartnerOnline: boolean;
  isPartnerTyping: boolean;
  isEligible?: boolean;
  myUserId: number | null;
  messages: PrivateMessage[];
  loadingHistory: boolean;
  hasMoreHistory: boolean;
  onLoadMore: () => void;
  onSendMessage: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
  onBack?: () => void;
}
