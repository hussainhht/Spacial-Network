"use client";

import { useCallback, useMemo, useState } from "react";
import type { Group, GroupMember } from "@/features/groups/types/group";
import { groupMessagesIntoTimeline } from "../utils/groupChatMessageGrouping";
import { useGroupChatAutoscroll } from "./useGroupChatAutoscroll";
import { useGroupChatConnection } from "./useGroupChatConnection";
import { useGroupChatMembers } from "./useGroupChatMembers";
import { useGroupChatMessages } from "./useGroupChatMessages";

export const MAX_GROUP_MESSAGE_LENGTH = 2000;
export const NEAR_GROUP_MESSAGE_THRESHOLD = 1800;

interface UseGroupChatControllerProps {
  group: Group;
  members: GroupMember[];
  membersLoading: boolean;
  isMember: boolean;
}

export function useGroupChatController({
  group,
  members,
  membersLoading,
  isMember,
}: UseGroupChatControllerProps) {
  // Mobile / tablet drawer
  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false);
  const openInfoSheet = useCallback(() => setIsInfoSheetOpen(true), []);
  const closeInfoSheet = useCallback(() => setIsInfoSheetOpen(false), []);

  // Connection and presence
  const connection = useGroupChatConnection(members);

  // Autoscroll management
  const autoscroll = useGroupChatAutoscroll();

  // Stable identity so the hook's initial-load effect (keyed on this
  // callback) doesn't see a "new" function on every render and refetch.
  const { scrollToLatest } = autoscroll;
  const onInitialScrollToBottom = useCallback(() => {
    scrollToLatest(false);
  }, [scrollToLatest]);

  // Messages and real-time events
  const chatMessages = useGroupChatMessages({
    groupId: group.id,
    isMember,
    onNewMessageArrived: autoscroll.notifyNewMessage,
    captureScrollAnchor: autoscroll.captureScrollAnchor,
    restoreScrollAnchor: autoscroll.restoreScrollAnchor,
    onInitialScrollToBottom,
  });

  // Group timeline clusters and day dividers
  const timelineItems = useMemo(() => {
    return groupMessagesIntoTimeline(
      chatMessages.messages,
      chatMessages.myUserId,
      group.creatorId
    );
  }, [chatMessages.messages, chatMessages.myUserId, group.creatorId]);

  // Members rail/sheet data
  const memberSearch = useGroupChatMembers({
    members,
    creatorId: group.creatorId,
    isUserOnline: connection.isUserOnline,
  });

  // Composer draft state
  const [inputText, setInputText] = useState("");
  const charCount = inputText.length;
  const isOverLimit = charCount > MAX_GROUP_MESSAGE_LENGTH;
  const isNearLimit = charCount >= NEAR_GROUP_MESSAGE_THRESHOLD;

  const sendMessage = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || isOverLimit || !isMember) return false;

    chatMessages.sendGroupMessage(trimmed);
    setInputText("");
    return true;
  }, [chatMessages, inputText, isMember, isOverLimit]);

  return {
    group,
    isMember,
    membersLoading,
    timelineItems,
    rawMessagesCount: chatMessages.messages.length,
    loading: chatMessages.loading,
    loadingMore: chatMessages.loadingMore,
    hasMore: chatMessages.hasMore,
    error: chatMessages.error,
    loadMoreHistory: chatMessages.loadMoreHistory,
    retryInitialLoad: chatMessages.retryInitialLoad,

    connectionStatus: connection.status,
    isConnected: connection.isConnected,
    onlineCount: connection.onlineCount,
    isUserOnline: connection.isUserOnline,

    timelineRef: autoscroll.timelineRef,
    isAtBottom: autoscroll.isAtBottom,
    unreadCount: autoscroll.unreadCount,
    scrollToLatest: autoscroll.scrollToLatest,

    membersList: memberSearch.members,
    memberSearchQuery: memberSearch.searchQuery,
    setMemberSearchQuery: memberSearch.setSearchQuery,
    totalMembersCount: members.length || group.memberCount,

    isInfoSheetOpen,
    openInfoSheet,
    closeInfoSheet,

    inputText,
    setInputText,
    charCount,
    isOverLimit,
    isNearLimit,
    sendMessage,
  };
}

