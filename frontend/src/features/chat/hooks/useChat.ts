"use client";

import { useEffect, useState, useCallback } from "react";
import { useWebSocket } from "@/providers/WebSocketProvider";
import { getCurrentUser } from "@/features/auth/api/getCurrentUser";
import { getConversations, getChatHistory } from "@/features/chat/api/chat";
import type { ConversationSummary, PrivateMessage } from "@/features/chat/types/chat";

const HISTORY_PAGE_SIZE = 20;

export function useChat() {
  const {
    isConnected,
    onlineUserIDs,
    lastMessage,
    typingStatus,
    errorMessage,
    sendEvent,
  } = useWebSocket();

  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);

  // Active chat partner state
  const [activePartnerId, setActivePartnerId] = useState<number | null>(null);
  const [activePartnerUsername, setActivePartnerUsername] = useState<string>("");
  const [activePartnerAvatar, setActivePartnerAvatar] = useState<string | undefined>(undefined);

  // Messages in active conversation
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(0);

  // 1. Load current logged-in user and conversations list on mount
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const user = await getCurrentUser();
        if (isMounted && user) {
          setMyUserId(user.user_id);
        }

        const convos = await getConversations();
        if (isMounted) {
          setConversations(convos);
        }
      } catch (err) {
        console.error("Failed to load chat initial state:", err);
      } finally {
        if (isMounted) {
          setLoadingConversations(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Select a conversation & load message history
  const selectConversation = useCallback(
    async (partnerId: number, partnerUsername: string) => {
      setActivePartnerId(partnerId);
      setActivePartnerUsername(partnerUsername);
      setMessages([]);
      setHistoryOffset(0);
      setLoadingHistory(true);

      const convo = conversations.find((c) => c.partner_id === partnerId);
      setActivePartnerAvatar(convo?.partner_avatar);

      // Reset unread count locally in sidebar
      setConversations((prev) =>
        prev.map((c) =>
          c.partner_id === partnerId ? { ...c, unread_count: 0 } : c
        )
      );

      try {
        const history = await getChatHistory(partnerId, HISTORY_PAGE_SIZE, 0);
        // Backend returns descending (newest first). Reverse for chronological order
        const chronological = [...history].reverse();
        setMessages(chronological);
        setHasMoreHistory(history.length >= HISTORY_PAGE_SIZE);
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setLoadingHistory(false);
      }
    },
    [conversations]
  );

  // 3. Load older messages (Pagination / Scroll-up)
  const loadMoreHistory = useCallback(async () => {
    if (!activePartnerId || loadingHistory || !hasMoreHistory) return;

    setLoadingHistory(true);
    const nextOffset = historyOffset + HISTORY_PAGE_SIZE;

    try {
      const older = await getChatHistory(activePartnerId, HISTORY_PAGE_SIZE, nextOffset);
      if (older.length < HISTORY_PAGE_SIZE) {
        setHasMoreHistory(false);
      }

      const chronologicalOlder = [...older].reverse();
      setMessages((prev) => [...chronologicalOlder, ...prev]);
      setHistoryOffset(nextOffset);
    } catch (err) {
      console.error("Failed to load more chat history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [activePartnerId, historyOffset, hasMoreHistory, loadingHistory]);

  // 4. Handle incoming WebSocket messages live
  useEffect(() => {
    if (!lastMessage) return;

    const senderId = lastMessage.sender_id;
    const recipientId = lastMessage.recipient_id;
    const isForActiveChat =
      activePartnerId !== null &&
      ((senderId === activePartnerId && recipientId === myUserId) ||
        (senderId === myUserId && recipientId === activePartnerId));

    // A. If belongs to active chat, append message
    if (isForActiveChat) {
      const newMsg: PrivateMessage = {
        id: lastMessage.id || Date.now(),
        sender_id: senderId,
        recipient_id: recipientId,
        content: lastMessage.content,
        created_at: lastMessage.created_at || new Date().toISOString(),
      };

      setMessages((prev) => {
        if (newMsg.id && prev.some((m) => m.id === newMsg.id)) {
          return prev;
        }
        return [...prev, newMsg];
      });
    }

    // B. Update conversation preview snippet in sidebar & bump to top
    const partnerId = senderId === myUserId ? recipientId : senderId;

    setConversations((prev) => {
      const existing = prev.find((c) => c.partner_id === partnerId);
      const isUnread = senderId !== myUserId && partnerId !== activePartnerId;

      if (existing) {
        const updated: ConversationSummary = {
          ...existing,
          last_message: lastMessage.content,
          last_message_at: lastMessage.created_at || new Date().toISOString(),
          unread_count: isUnread ? existing.unread_count + 1 : existing.unread_count,
        };

        return [updated, ...prev.filter((c) => c.partner_id !== partnerId)];
      }

      const newItem: ConversationSummary = {
        partner_id: partnerId,
        partner_username: `User ${partnerId}`,
        partner_first_name: "",
        partner_last_name: "",
        last_message: lastMessage.content,
        last_message_at: lastMessage.created_at || new Date().toISOString(),
        unread_count: isUnread ? 1 : 0,
      };
      return [newItem, ...prev];
    });
  }, [lastMessage, activePartnerId, myUserId]);

  // 5. Send message handler
  const sendMessage = useCallback(
    (content: string) => {
      if (!activePartnerId) return;

      sendEvent("private_message", {
        recipient_id: activePartnerId,
        content,
      });
    },
    [activePartnerId, sendEvent]
  );

  // 6. Typing handler
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!activePartnerId) return;

      sendEvent("typing", {
        recipient_id: activePartnerId,
        is_typing: isTyping,
      });
    },
    [activePartnerId, sendEvent]
  );

  const isPartnerTyping = Boolean(
    activePartnerId &&
      typingStatus?.sender_id === activePartnerId &&
      typingStatus.is_typing
  );

  const isPartnerOnline = Boolean(
    activePartnerId && onlineUserIDs.includes(activePartnerId)
  );

  return {
    isConnected,
    errorMessage,
    myUserId,
    conversations,
    loadingConversations,
    activePartnerId,
    activePartnerUsername,
    activePartnerAvatar,
    messages,
    loadingHistory,
    hasMoreHistory,
    isPartnerOnline,
    isPartnerTyping,
    onlineUserIDs,
    selectConversation,
    loadMoreHistory,
    sendMessage,
    sendTyping,
  };
}
