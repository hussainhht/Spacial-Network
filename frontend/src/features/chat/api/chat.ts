import { apiRequest } from "@/lib/api/client";
import type { ConversationSummary, EligibleContact, PrivateMessage } from "../types/chat";

export function getConversations(): Promise<ConversationSummary[]> {
  return apiRequest<ConversationSummary[]>("/chat/conversations");
}

export function getEligibleContacts(
  search: string = "",
  limit: number = 20,
  offset: number = 0,
  contactId: number = 0
): Promise<EligibleContact[]> {
  const query = new URLSearchParams();
  if (search.trim()) {
    query.set("search", search.trim());
  }
  if (contactId > 0) {
    query.set("contact_id", contactId.toString());
  }
  if (limit > 0) {
    query.set("limit", limit.toString());
  }
  if (offset > 0) {
    query.set("offset", offset.toString());
  }

  const qs = query.toString();
  return apiRequest<EligibleContact[]>(`/chat/eligible-contacts${qs ? `?${qs}` : ""}`);
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
