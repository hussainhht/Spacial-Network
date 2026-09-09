"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWebSocket } from "@/providers/WebSocketProvider";
import { getCurrentUser } from "@/features/auth/api/getCurrentUser";
import { getConversations, getChatHistory, getEligibleContacts } from "@/features/chat/api/chat";
import { ApiError } from "@/lib/api/errors";
import type { ConversationSummary, EligibleContact, PrivateMessage } from "@/features/chat/types/chat";

const HISTORY_PAGE_SIZE = 20;

export function useChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isConnected,
    onlineUserIDs,
    lastMessage,
    typingStatus,
    lastReadReceipt,
    errorMessage,
    sendEvent,
  } = useWebSocket();

  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [isPartnerEligible, setIsPartnerEligible] = useState<boolean>(true);

  const [activePartnerId, setActivePartnerId] = useState<number | null>(null);
  const [activePartnerUsername, setActivePartnerUsername] = useState<string>("");
  const [activePartnerAvatar, setActivePartnerAvatar] = useState<string | undefined>(undefined);

  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(0);

  const conversationsRef = useRef<ConversationSummary[]>([]);
  conversationsRef.current = conversations;
  const lastHandledMsgRef = useRef<string | null>(null);
  const lastHandledReceiptRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push("/login");
          return;
        }

        if (isMounted) {
          setMyUserId(user.user_id);
        }

        const convos = await getConversations().catch(() => []);

        if (isMounted) {
          setConversations(convos);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
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
  }, [router]);

  // Check eligibility for the active chat partner
  useEffect(() => {
    if (!activePartnerId) {
      setIsPartnerEligible(true);
      return;
    }

    let isMounted = true;
    getEligibleContacts("", 1, 0, activePartnerId)
      .then((contacts) => {
        if (isMounted) {
          setIsPartnerEligible(contacts.length > 0 && contacts[0].id === activePartnerId);
        }
      })
      .catch(() => {
        // Keep eligible on transient error; WebSocket will gate send if blocked
        if (isMounted) {
          setIsPartnerEligible(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activePartnerId]);

  const selectConversation = useCallback(
    async (partnerId: number, partnerUsername: string, partnerAvatar?: string) => {
      setActivePartnerId(partnerId);
      setActivePartnerUsername(partnerUsername);
      setMessages([]);
      setHistoryOffset(0);
      setLoadingHistory(true);

      const convo = conversationsRef.current.find((c) => c.partner_id === partnerId);
      setActivePartnerAvatar(partnerAvatar || convo?.partner_avatar);

      setConversations((prev) =>
        prev.map((c) =>
          c.partner_id === partnerId ? { ...c, unread_count: 0 } : c
        )
      );

      sendEvent("mark_read", { sender_id: partnerId });

      try {
        const history = await getChatHistory(partnerId, HISTORY_PAGE_SIZE, 0);
        setMessages(history);
        setHasMoreHistory(history.length >= HISTORY_PAGE_SIZE);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        console.error("Failed to load chat history:", err);
      } finally {
        setLoadingHistory(false);
      }
    },
    [router, sendEvent]
  );

  const searchPartnerId = searchParams.get("partnerId");
  useEffect(() => {
    if (!searchPartnerId || loadingConversations) return;
    const pid = parseInt(searchPartnerId, 10);
    if (!isNaN(pid) && pid > 0 && pid !== activePartnerId) {
      const found = conversationsRef.current.find((c) => c.partner_id === pid);
      if (found) {
        selectConversation(pid, found.partner_username, found.partner_avatar);
      } else {
        getEligibleContacts("", 1, 0, pid)
          .then((contacts) => {
            if (contacts.length > 0) {
              selectConversation(pid, contacts[0].username, contacts[0].profile_photo || undefined);
            } else {
              selectConversation(pid, `User ${pid}`);
            }
          })
          .catch(() => {
            selectConversation(pid, `User ${pid}`);
          });
      }
    }
  }, [searchPartnerId, loadingConversations, activePartnerId, selectConversation]);

  const loadMoreHistory = useCallback(async () => {
    if (!activePartnerId || loadingHistory || !hasMoreHistory) return;

    setLoadingHistory(true);
    const nextOffset = historyOffset + HISTORY_PAGE_SIZE;

    try {
      const older = await getChatHistory(activePartnerId, HISTORY_PAGE_SIZE, nextOffset);
      if (older.length < HISTORY_PAGE_SIZE) {
        setHasMoreHistory(false);
      }

      setMessages((prev) => [...older, ...prev]);
      setHistoryOffset(nextOffset);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }
      console.error("Failed to load more chat history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [activePartnerId, historyOffset, hasMoreHistory, loadingHistory, router]);

  useEffect(() => {
    if (!lastMessage) return;

    const msgKey = `${lastMessage.id || ""}-${lastMessage.sender_id}-${lastMessage.recipient_id}-${lastMessage.content}-${lastMessage.created_at || ""}`;
    if (lastHandledMsgRef.current === msgKey) return;
    lastHandledMsgRef.current = msgKey;

    const senderId = lastMessage.sender_id;
    const recipientId = lastMessage.recipient_id;
    const isForActiveChat =
      activePartnerId !== null &&
      ((senderId === activePartnerId && recipientId === myUserId) ||
        (senderId === myUserId && recipientId === activePartnerId));

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

      if (senderId === activePartnerId) {
        sendEvent("mark_read", { sender_id: activePartnerId });
      }
    }

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
  }, [lastMessage, activePartnerId, myUserId, sendEvent]);

  useEffect(() => {
    if (!lastReadReceipt) return;
    const { reader_id, sender_id, read_at } = lastReadReceipt;

    const receiptKey = `${reader_id}-${sender_id}-${read_at}`;
    if (lastHandledReceiptRef.current === receiptKey) return;
    lastHandledReceiptRef.current = receiptKey;

    if (
      activePartnerId !== null &&
      reader_id === activePartnerId &&
      sender_id === myUserId
    ) {
      setMessages((prev) =>
        prev.map((m) =>
          m.sender_id === myUserId && !m.read_at ? { ...m, read_at } : m
        )
      );
    }
  }, [lastReadReceipt, activePartnerId, myUserId]);

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

  const isPermissionBlocked =
    !isPartnerEligible ||
    Boolean(errorMessage && errorMessage.toLowerCase().includes("only message users you follow"));

  return {
    isConnected,
    errorMessage,
    myUserId,
    conversations,
    loadingConversations,
    activePartnerId,
    activePartnerUsername,
    activePartnerAvatar,
    isPartnerEligible: !isPermissionBlocked,
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
