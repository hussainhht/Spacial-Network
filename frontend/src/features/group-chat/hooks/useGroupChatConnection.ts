"use client";

import { useMemo } from "react";
import { useWebSocket } from "@/providers/WebSocketProvider";
import type { GroupMember } from "@/features/groups/types/group";
import type { GroupChatConnectionStatus } from "../types/groupChat";

export function useGroupChatConnection(members: GroupMember[]) {
  const { isConnected, onlineUserIDs, errorMessage } = useWebSocket();

  const status: GroupChatConnectionStatus = useMemo(() => {
    if (isConnected) return "connected";
    if (errorMessage) return "offline";
    return "reconnecting";
  }, [isConnected, errorMessage]);

  const onlineMemberUserIds = useMemo(() => {
    const memberIdSet = new Set(members.map((m) => m.userId));
    return onlineUserIDs.filter((id) => memberIdSet.has(id));
  }, [members, onlineUserIDs]);

  const onlineCount = onlineMemberUserIds.length;

  const isUserOnline = useMemo(() => {
    const onlineSet = new Set(onlineUserIDs);
    return (userId: number) => onlineSet.has(userId);
  }, [onlineUserIDs]);

  return {
    status,
    isConnected,
    errorMessage,
    onlineCount,
    onlineUserIDs,
    isUserOnline,
  };
}

