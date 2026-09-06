export interface Group {
  creatorUsername: string;
  memberCount: number;
  membershipRole?: string;
  hasPendingJoinRequest: boolean;
  hasPendingInvitation: boolean;
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
  avatar?: string;
  userId: number;
  username: string;
  role: string;
  joinedAt: string;
}

export interface Membership {
  hasPendingJoinRequest: boolean;
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

export interface GroupInvitation {
  groupTitle: string;
  inviterUsername: string;
  id: number;
  groupId: number;
  invitedBy: number;
  invitedUserId: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}


export interface GroupJoinRequest {
  id: number;
  groupId: number;
  userId: number;
  username: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type EventResponseStatus = "going" | "not_going";

export interface GroupEvent {
  id: number;
  groupId: number;
  createdBy: number;
  title: string;
  description: string;
  eventTime: string;
  createdAt: string;
  updatedAt: string;
  // Only ever populated by the single-event endpoint; the group events list
  // does not return it (see backend contract gap in the feature report).
  currentUserResponse?: EventResponseStatus;
}

export interface CreateEventInput {
  title: string;
  description: string;
  eventTime: string;
}
