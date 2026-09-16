import { apiRequest } from "@/lib/api/client";
import type { GroupMessagePayload } from "@/lib/websocket/types";

export function getGroupChatHistory(
  groupId: number,
  limit: number = 20,
  offset: number = 0,
  signal?: AbortSignal
): Promise<GroupMessagePayload[]> {
  const query = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  return apiRequest<GroupMessagePayload[]>(
    `/groups/${groupId}/messages?${query.toString()}`,
    { signal }
  );
}

