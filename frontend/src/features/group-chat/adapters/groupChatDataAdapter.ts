import type { GroupMessagePayload } from "@/lib/websocket/types";
import type { GroupChatMessage } from "../types/groupChat";

export function normalizeGroupMessage(payload: GroupMessagePayload): GroupChatMessage {
  const createdAt = payload.created_at || new Date().toISOString();
  const id =
    payload.id !== undefined && payload.id !== null
      ? payload.id
      : `tmp_${payload.user_id}_${createdAt}_${payload.content.slice(0, 16)}`;

  return {
    id,
    groupId: payload.group_id,
    userId: payload.user_id,
    username: payload.username,
    firstName: payload.first_name,
    lastName: payload.last_name,
    avatar: payload.avatar,
    content: payload.content,
    createdAt,
  };
}

function getMessageKey(message: GroupChatMessage): string {
  if (typeof message.id === "number" || (typeof message.id === "string" && !message.id.startsWith("tmp_"))) {
    return `id_${message.id}`;
  }
  return `comp_${message.userId}_${message.createdAt}_${message.content}`;
}

export function deduplicateAndSortMessages(
  existingMessages: GroupChatMessage[],
  incomingMessages: GroupChatMessage[]
): GroupChatMessage[] {
  const map = new Map<string, GroupChatMessage>();

  for (const msg of existingMessages) {
    map.set(getMessageKey(msg), msg);
  }

  for (const msg of incomingMessages) {
    const key = getMessageKey(msg);
    // If incoming message has real ID, it can replace a temporary one with same user/content/time
    if (typeof msg.id === "number") {
      const compKey = `comp_${msg.userId}_${msg.createdAt}_${msg.content}`;
      if (map.has(compKey)) {
        map.delete(compKey);
      }
    }
    map.set(key, msg);
  }

  const allMessages = Array.from(map.values());

  allMessages.sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    // Stable tie-breaker with IDs if both are numbers
    if (typeof a.id === "number" && typeof b.id === "number") {
      return a.id - b.id;
    }
    return String(a.id).localeCompare(String(b.id));
  });

  return allMessages;
}

