// Client for the Go backend's Chat API (/api/chat/conversations and /api/chat/history).

import { apiRequest } from "@/lib/api/client";
import type { ConversationSummary, PrivateMessage } from "../types/chat";

/**
 * Fetches all recent conversations for the current user.
 */
export function getConversations(): Promise<ConversationSummary[]> {
  return apiRequest<ConversationSummary[]>("/chat/conversations");
}

/**
 * Fetches paginated chat history between the current user and a target user.
 */
export function getChatHistory(
  userId: number,
  limit: number = 10,
  offset: number = 0
): Promise<PrivateMessage[]> {
  const query = new URLSearchParams({
    user_id: userId.toString(),
    limit: limit.toString(),
    offset: offset.toString(),
  });

  return apiRequest<PrivateMessage[]>(`/chat/history?${query.toString()}`);
}
