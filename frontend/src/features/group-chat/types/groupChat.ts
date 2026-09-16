import type { Group, GroupMember } from "@/features/groups/types/group";

export interface GroupChatMessage {
  id: number | string;
  groupId: number;
  userId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  content: string;
  createdAt: string;
}

export interface GroupChatMessageItem {
  id: number | string;
  content: string;
  createdAt: string;
}

export interface GroupChatMessageCluster {
  clusterId: string;
  userId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isMine: boolean;
  isCreator?: boolean;
  firstCreatedAt: string;
  messages: GroupChatMessageItem[];
}

export type TimelineItem =
  | {
      type: "day-divider";
      id: string;
      label: string;
      dateKey: string;
    }
  | {
      type: "cluster";
      id: string;
      cluster: GroupChatMessageCluster;
    };

export type GroupChatConnectionStatus = "connected" | "reconnecting" | "offline";

export interface GroupChatViewProps {
  group: Group;
  members: GroupMember[];
  membersLoading: boolean;
  isMember: boolean;
  onViewMembers: () => void;
}

