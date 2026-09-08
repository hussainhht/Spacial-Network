import { apiRequest } from "@/lib/api/client";
import type { ConversationSummary, EligibleContact, PrivateMessage } from "../types/chat";

export function getConversations(): Promise<ConversationSummary[]> {
  return apiRequest<ConversationSummary[]>("/chat/conversations");
}

export function getEligibleContacts(): Promise<EligibleContact[]> {
  return apiRequest<EligibleContact[]>("/chat/eligible-contacts");
}

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
