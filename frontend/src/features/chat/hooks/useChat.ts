"use client";

import { useWebSocket } from "@/providers/WebSocketProvider";
import type { MessagePayload } from "@/lib/websocket/types";

export function useChat(recipientID: number) {
  const { sendEvent, onlineUserIDs, lastMessage, typingStatus } = useWebSocket();

  const isPartnerOnline = onlineUserIDs.includes(recipientID);
  const isPartnerTyping =
    typingStatus?.sender_id === recipientID && typingStatus.is_typing;

  function sendMessage(content: string) {
    if (!content.trim()) return;

    sendEvent("private_message", {
      recipient_id: recipientID,
      content: content.trim(),
    });
  }

  function sendTyping(isTyping: boolean) {
    sendEvent("typing", {
      recipient_id: recipientID,
      is_typing: isTyping,
    });
  }

  function isMessageForThisChat(message: MessagePayload | null, myUserID: number): boolean {
    if (!message) return false;
    return (
      (message.sender_id === recipientID && message.recipient_id === myUserID) ||
      (message.sender_id === myUserID && message.recipient_id === recipientID)
    );
  }

  return {
    sendMessage,
    sendTyping,
    isPartnerOnline,
    isPartnerTyping,
    lastMessage,
    isMessageForThisChat,
  };
}
