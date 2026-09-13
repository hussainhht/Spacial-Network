"use client";

import { useEffect, useState } from "react";
import { toInviteCandidate } from "../api/groups";
import { useWebSocket } from "@/providers/WebSocketProvider";

const SEARCH_DEBOUNCE_MS = 200;
const SEARCH_LIMIT = 10;

function makeRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

export function useInviteUserSearch(groupId: number) {
  const { isConnected, sendEvent, inviteSearchResults, errorMessage } = useWebSocket();
  const [query, setQuery] = useState("");
  const [request, setRequest] = useState<{ id: string; groupId: number; query: string } | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    const timeoutId = setTimeout(() => {
      const id = makeRequestId();
      setRequest({ id, groupId, query: trimmed });
      sendEvent("invite_user_search", {
        request_id: id,
        group_id: groupId,
        query: trimmed,
        limit: SEARCH_LIMIT,
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [groupId, trimmed, sendEvent]);

  const matchesRequest = Boolean(trimmed && request?.query === trimmed && request.groupId === groupId);
  const response = matchesRequest && inviteSearchResults?.request_id === request?.id &&
    inviteSearchResults?.group_id === groupId ? inviteSearchResults : null;
  const loading = Boolean(trimmed && !response);

  return {
    isConnected,
    query,
    setQuery: (value: string) => {
      setQuery(value);
      setRequest(null);
    },
    results: response?.users.map(toInviteCandidate) ?? [],
    loading,
    errorMessage,
    wsErrorPending: loading && Boolean(errorMessage),
  };
}
