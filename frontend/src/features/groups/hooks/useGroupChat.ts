"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "@/providers/WebSocketProvider";
import { getCurrentUser } from "@/features/auth/api/getCurrentUser";
import { getGroupChatHistory } from "../api/chat";
import type { GroupMessagePayload } from "@/lib/websocket/types";

const PAGE_SIZE = 20;

export function useGroupChat(groupId: number, isMember: boolean) {
  const { isConnected, sendEvent, subscribeGroupMessages } = useWebSocket();
  const [messages, setMessages] = useState<GroupMessagePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<number | null>(null);

  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  // Load current user
  useEffect(() => {
    let isMounted = true;
    getCurrentUser()
      .then((user) => {
        if (isMounted && user) {
          setMyUserId(user.user_id);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Load initial history when group or membership changes
  useEffect(() => {
    if (!isMember || !groupId) {
      setMessages([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    getGroupChatHistory(groupId, PAGE_SIZE, 0)
      .then((history) => {
        if (isMounted) {
          setMessages(history);
          setHasMore(history.length >= PAGE_SIZE);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load chat history");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [groupId, isMember]);

  // Subscribe to real-time incoming group messages
  useEffect(() => {
    const unsubscribe = subscribeGroupMessages((newMsg) => {
      if (newMsg.group_id !== groupIdRef.current) return;

      setMessages((prev) => {
        // Prevent duplicate messages if already present
        if (newMsg.id && prev.some((m) => m.id === newMsg.id)) {
          return prev;
        }
        return [...prev, newMsg];
      });
    });

    return unsubscribe;
  }, [subscribeGroupMessages]);

  const loadMoreHistory = useCallback(async () => {
    if (!isMember || !groupId || loadingMore || !hasMore) return;

    setLoadingMore(true);
    const offset = messages.length;

    try {
      const older = await getGroupChatHistory(groupId, PAGE_SIZE, offset);
      if (older.length < PAGE_SIZE) {
        setHasMore(false);
      }
      setMessages((prev) => [...older, ...prev]);
    } catch (err) {
      console.error("Failed to load older group messages:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [groupId, isMember, loadingMore, hasMore, messages.length]);

  const sendGroupMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !groupId || !isMember) return;

      sendEvent("group_message", {
        group_id: groupId,
        content: trimmed,
      });
    },
    [groupId, isMember, sendEvent]
  );

  return {
    isConnected,
    myUserId,
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    sendGroupMessage,
    loadMoreHistory,
  };
}
