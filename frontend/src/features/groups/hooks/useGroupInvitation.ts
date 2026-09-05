"use client";

import { useState } from "react";

import { createGroupInvitation } from "../api/groups";

export function useGroupInvitation(groupId: number) {
  const [invitingId, setInvitingId] = useState<number | null>(null);
  const [invitedIds, setInvitedIds] = useState<number[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  async function handleInvite(userId: number) {
    setInvitingId(userId);
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });

    try {
      await createGroupInvitation(groupId, userId);
      setInvitedIds((prev) => [...prev, userId]);
    } catch (error) {
      setRowErrors((prev) => ({
        ...prev,
        [userId]: error instanceof Error ? error.message : "Failed to send invitation",
      }));
    } finally {
      setInvitingId(null);
    }
  }

  return {
    invitingId,
    invitedIds,
    rowErrors,
    handleInvite,
  };
}
