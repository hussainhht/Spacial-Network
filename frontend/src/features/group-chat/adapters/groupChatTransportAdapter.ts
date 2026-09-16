import type { EventType, GroupMessagePayload } from "@/lib/websocket/types";

export interface GroupChatTransport {
  sendMessage: (groupId: number, content: string) => void;
  subscribe: (
    groupId: number,
    listener: (message: GroupMessagePayload) => void
  ) => () => void;
}

export function createGroupChatTransport(
  sendEvent: (type: EventType, payload: unknown) => void,
  subscribeGroupMessages: (
    listener: (msg: GroupMessagePayload) => void
  ) => () => void
): GroupChatTransport {
  return {
    sendMessage(groupId: number, content: string) {
      const trimmed = content.trim();
      if (!trimmed || !groupId) return;
      sendEvent("group_message", {
        group_id: groupId,
        content: trimmed,
      });
    },

    subscribe(groupId: number, listener: (message: GroupMessagePayload) => void) {
      return subscribeGroupMessages((newMsg) => {
        if (newMsg.group_id === groupId) {
          listener(newMsg);
        }
      });
    },
  };
}
