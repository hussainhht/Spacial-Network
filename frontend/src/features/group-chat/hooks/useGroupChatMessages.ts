"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/features/auth/context/CurrentUserContext";
import { getGroupChatHistory } from "../api/groupChatApi";
import { useWebSocket } from "@/providers/WebSocketProvider";
import {
  deduplicateAndSortMessages,
  normalizeGroupMessage,
} from "../adapters/groupChatDataAdapter";
import { createGroupChatTransport } from "../adapters/groupChatTransportAdapter";
import type { GroupChatMessage } from "../types/groupChat";

const PAGE_SIZE = 20;

interface UseGroupChatMessagesOptions {
  groupId: number;
  isMember: boolean;
  onNewMessageArrived: (isMine: boolean) => void;
  captureScrollAnchor: () => number;
  restoreScrollAnchor: (offset: number) => void;
  onInitialScrollToBottom: () => void;
}

export function useGroupChatMessages({
  groupId,
  isMember,
  onNewMessageArrived,
  captureScrollAnchor,
  restoreScrollAnchor,
  onInitialScrollToBottom,
}: UseGroupChatMessagesOptions) {
  const { user } = useCurrentUser();
  const { sendEvent, subscribeGroupMessages } = useWebSocket();
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myUserId = user.user_id ?? null;
  const initialScrolledRef = useRef(false);

  // Caller-supplied callbacks are read through a ref so that a caller which
  // doesn't memoize them (a new function identity every render) can't turn
  // this effect's dependency array into a request loop: dependencies here
  // are limited to the primitives that genuinely identify "which group's
  // history should be loaded" (groupId, isMember).
  const onInitialScrollToBottomRef = useRef(onInitialScrollToBottom);
  useEffect(() => {
    onInitialScrollToBottomRef.current = onInitialScrollToBottom;
  }, [onInitialScrollToBottom]);

  // Initial load - runs once per (groupId, isMember) change only.
  useEffect(() => {
    initialScrolledRef.current = false;

    if (!isMember || !groupId) {
      queueMicrotask(() => {
        setMessages([]);
        setLoading(false);
        setHasMore(false);
      });
      return;
    }

    let isMounted = true;
    // Cancels the in-flight request on cleanup so a dev-only StrictMode
    // remount (mount -> cleanup -> mount) leaves at most one request
    // in flight for this groupId, instead of one per invocation.
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!isMounted) return;
      setLoading(true);
      setError(null);
    });

    getGroupChatHistory(groupId, PAGE_SIZE, 0, controller.signal)
      .then((history) => {
        if (!isMounted) return;
        const normalized = history.map(normalizeGroupMessage);
        const sorted = deduplicateAndSortMessages([], normalized);
        setMessages(sorted);
        setHasMore(history.length >= PAGE_SIZE);

        // Position at bottom on initial history load
        window.requestAnimationFrame(() => {
          if (!initialScrolledRef.current) {
            onInitialScrollToBottomRef.current();
            initialScrolledRef.current = true;
          }
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load chat history",
        );
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [groupId, isMember]);

  // Real-time WebSocket subscription
  useEffect(() => {
    if (!groupId || !isMember) return;

    const transport = createGroupChatTransport(
      sendEvent,
      subscribeGroupMessages,
    );

    const unsubscribe = transport.subscribe(groupId, (newPayload) => {
      setError(null);
      const normalized = normalizeGroupMessage(newPayload);
      const isMine = myUserId !== null && normalized.userId === myUserId;

      onNewMessageArrived(isMine);

      setMessages((prev) => deduplicateAndSortMessages(prev, [normalized]));
    });

    return unsubscribe;
  }, [
    groupId,
    isMember,
    myUserId,
    onNewMessageArrived,
    sendEvent,
    subscribeGroupMessages,
  ]);

  // Load older messages with scroll anchoring
  const loadMoreHistory = useCallback(async () => {
    if (!isMember || !groupId || loadingMore || !hasMore) return;

    setLoadingMore(true);
    const offset = messages.length;
    const anchorOffset = captureScrollAnchor();

    try {
      const olderHistory = await getGroupChatHistory(
        groupId,
        PAGE_SIZE,
        offset,
      );
      if (olderHistory.length < PAGE_SIZE) {
        setHasMore(false);
      }

      const normalizedOlder = olderHistory.map(normalizeGroupMessage);
      setMessages((prev) => deduplicateAndSortMessages(normalizedOlder, prev));

      // Restore scroll anchor to prevent any visual jump
      restoreScrollAnchor(anchorOffset);
    } catch (err) {
      console.error("Failed to load older group messages:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [
    captureScrollAnchor,
    groupId,
    hasMore,
    isMember,
    loadingMore,
    messages.length,
    restoreScrollAnchor,
  ]);

  const sendGroupMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !groupId || !isMember) return;

      setError(null);
      const transport = createGroupChatTransport(
        sendEvent,
        subscribeGroupMessages,
      );
      transport.sendMessage(groupId, trimmed);
    },
    [groupId, isMember, sendEvent, subscribeGroupMessages],
  );

  const retryInitialLoad = useCallback(() => {
    if (!groupId || !isMember) return;
    setLoading(true);
    setError(null);
    getGroupChatHistory(groupId, PAGE_SIZE, 0)
      .then((history) => {
        const normalized = history.map(normalizeGroupMessage);
        const sorted = deduplicateAndSortMessages([], normalized);
        setMessages(sorted);
        setHasMore(history.length >= PAGE_SIZE);
        window.requestAnimationFrame(() => {
          onInitialScrollToBottom();
        });
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load chat history",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [groupId, isMember, onInitialScrollToBottom]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    myUserId,
    sendGroupMessage,
    loadMoreHistory,
    retryInitialLoad,
  };
}
