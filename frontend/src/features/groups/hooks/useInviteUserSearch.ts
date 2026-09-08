"use client";

import { useEffect, useRef, useState } from "react";

import { toInviteCandidate } from "../api/groups";
import { useWebSocket } from "@/providers/WebSocketProvider";
import type { InviteCandidate } from "../types/group";

const SEARCH_DEBOUNCE_MS = 200;
const SEARCH_LIMIT = 10;

function makeRequestId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

export function useInviteUserSearch(groupId: number) {
  const { isConnected, sendEvent, inviteSearchResults, errorMessage } =
    useWebSocket();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InviteCandidate[]>([]);
  const [loading, setLoading] = useState(false);

  const latestRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length === 0) {
      latestRequestIdRef.current = null;
      setResults([]);
      setLoading(false);
      return;
    }

    const requestId = makeRequestId();

    const timeoutId = setTimeout(() => {
      latestRequestIdRef.current = requestId;
      setLoading(true);
      sendEvent("invite_user_search", {
        request_id: requestId,
        group_id: groupId,
        query: trimmed,
        limit: SEARCH_LIMIT,
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [groupId, query, sendEvent]);

  useEffect(() => {
    if (!inviteSearchResults) return;
    if (inviteSearchResults.request_id !== latestRequestIdRef.current) return;
    if (inviteSearchResults.group_id !== groupId) return;

    setResults(inviteSearchResults.users.map(toInviteCandidate));
    setLoading(false);
  }, [inviteSearchResults, groupId]);

  const wsErrorPending = loading && Boolean(errorMessage);

  return {
    isConnected,
    query,
    setQuery,
    results,
    loading,
    errorMessage,
    wsErrorPending,
  };
}
