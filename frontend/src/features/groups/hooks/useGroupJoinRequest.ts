"use client";

import { useState } from "react";

import { createJoinRequest } from "../api/groups";

type JoinRequestStatus = "idle" | "requesting" | "requested";

export function useGroupJoinRequest(groupId: number) {
  const [status, setStatus] = useState<JoinRequestStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleRequestToJoin() {
    setStatus("requesting");
    setError(null);

    try {
      await createJoinRequest(groupId);
      setStatus("requested");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send join request");
      setStatus("idle");
    }
  }

  return { status, error, handleRequestToJoin };
}
