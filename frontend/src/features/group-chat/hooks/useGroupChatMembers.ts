"use client";

import { useMemo, useState } from "react";
import type { GroupMember } from "@/features/groups/types/group";

interface UseGroupChatMembersOptions {
  members: GroupMember[];
  creatorId?: number;
  isUserOnline: (userId: number) => boolean;
}

export function useGroupChatMembers({
  members,
  creatorId,
  isUserOnline,
}: UseGroupChatMembersOptions) {
  const [searchQuery, setSearchQuery] = useState("");

  const sortedAndFilteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = q
      ? members.filter(
          (m) =>
            m.username.toLowerCase().includes(q) ||
            m.role.toLowerCase().includes(q)
        )
      : members;

    return [...filtered].sort((a, b) => {
      // 1. Creator first
      const aIsCreator = a.userId === creatorId || a.role === "creator";
      const bIsCreator = b.userId === creatorId || b.role === "creator";
      if (aIsCreator && !bIsCreator) return -1;
      if (!aIsCreator && bIsCreator) return 1;

      // 2. Online members next
      const aOnline = isUserOnline(a.userId);
      const bOnline = isUserOnline(b.userId);
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;

      // 3. Username alphabetical
      return a.username.localeCompare(b.username);
    });
  }, [members, creatorId, isUserOnline, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    members: sortedAndFilteredMembers,
    totalCount: members.length,
  };
}

