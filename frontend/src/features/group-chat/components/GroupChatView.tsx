"use client";

import { useGroupChatController } from "../hooks/useGroupChatController";
import type { GroupChatViewProps } from "../types/groupChat";
import GroupChatAccessState from "./GroupChatAccessState";
import GroupChatShell from "./GroupChatShell";

export default function GroupChatView({
  group,
  members,
  membersLoading,
  isMember,
  onViewMembers,
}: GroupChatViewProps) {
  const controller = useGroupChatController({
    group,
    members,
    membersLoading,
    isMember,
  });

  if (!isMember) {
    return <GroupChatAccessState />;
  }

  return (
    <GroupChatShell
      controller={controller}
      onViewMembers={onViewMembers}
    />
  );
}
