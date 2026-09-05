export interface Group {
  id: number;
  creatorId: number;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupInput {
  title: string;
  description: string;
}

export interface GroupMember {
  userId: number;
  username: string;
  role: string;
  joinedAt: string;
}

export interface Membership {
  isMember: boolean;
  role?: string;
}

export interface InviteCandidate {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

// A pending invitation for the current user to join a group (GET
// /group-invitations). Used by the notifications feature to resolve a group
// invitation notification's entity_id (the invitation ID) to the group it
// refers to, since the notification itself only carries the invitation ID.
export interface GroupInvitation {
  id: number;
  groupId: number;
  invitedBy: number;
  invitedUserId: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

