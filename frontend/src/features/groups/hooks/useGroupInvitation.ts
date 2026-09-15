"use client";

import { useRef, useState } from "react";

import { createGroupInvitation } from "../api/groups";

export function useGroupInvitation(groupId: number) {
  const [invitingId, setInvitingId] = useState<number | null>(null);
  const [invitedIds, setInvitedIds] = useState<number[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const pendingIdsRef = useRef(new Set<number>());

  async function handleInvite(userId: number) {
    if (pendingIdsRef.current.has(userId) || invitedIds.includes(userId)) return;
    pendingIdsRef.current.add(userId);
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
      pendingIdsRef.current.delete(userId);
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
