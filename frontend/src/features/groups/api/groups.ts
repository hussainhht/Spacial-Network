import type { Group , CreateGroupInput, GroupMember, Membership, InviteCandidate } from "../types/group";
import { getApiBaseUrl, getUploadsBaseUrl } from "@/lib/api";

interface ApiGroup {
  id: number;
  creator_id: number;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}



interface ApiGroupMember {
  user_id: number;
  username: string;
  role: string;
  joined_at: string;
}

interface GroupMembersResponse {
  success: boolean;
  message?: string;
  members?: ApiGroupMember[];
}

interface GroupsResponse {
  success: boolean;
  message?: string;
  groups?: ApiGroup[];
}

interface CreateGroupResponse {
  success: boolean;
  message?: string;
  group_id?: number;
}

interface GetGroupResponse {
  success: boolean;
  message?: string;
  group?: ApiGroup;
}

interface MembershipResponse {
  success: boolean;
  message?: string;
  is_member: boolean;
  role?: string;
}

interface ApiInviteCandidate {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  avatar?: string;
}

interface CreateGroupInvitationResponse {
  success: boolean;
  message?: string;
}

interface CreateJoinRequestResponse {
  success: boolean;
  message?: string;
}

export async function getGroup(groupId: number): Promise<Group> {
  const response = await fetch(`${getApiBaseUrl()}/groups/${groupId}`, {
    method: "GET",
    credentials: "include",
  });

  const data: GetGroupResponse = await response.json();

  if (!response.ok || !data.success || !data.group) {
    throw new Error(data.message ?? "Failed to load group");
  }

  return toGroup(data.group);
}

function toGroupMember(member: ApiGroupMember): GroupMember {
  return {
    userId: member.user_id,
    username: member.username,
    role: member.role,
    joinedAt: member.joined_at,
  };
}

// Exported so the WebSocket-based search results (same field shape as the
// HTTP search response's `users`) can go through the same mapping.
export function toInviteCandidate(user: ApiInviteCandidate): InviteCandidate {
  return {
    id: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    avatar: user.avatar,
  };
}

// avatarUrl turns a raw profile_photo path (as stored/returned by the
// backend, e.g. "avatars/xxx.jpg") into a URL the browser can load. The
// backend serves uploads directly from /uploads/, outside of /api/.
export function avatarUrl(profilePhoto?: string): string | undefined {
  if (!profilePhoto) return undefined;
  if (/^https?:\/\//.test(profilePhoto)) return profilePhoto;
  return `${getUploadsBaseUrl()}/${profilePhoto}`;
}

function toGroup(group: ApiGroup): Group {
  return {
    id: group.id,
    creatorId: group.creator_id,
    title: group.title,
    description: group.description,
    createdAt: group.created_at,
    updatedAt: group.updated_at,
  };
}

export async function getGroups(): Promise<Group[]> {
  const response = await fetch(`${getApiBaseUrl()}/groups`, {
    method: "GET",
    credentials: "include",
  });

  const data: GroupsResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to load groups");
  }

  return (data.groups ?? []).map(toGroup);
}


export async function createGroup(
  input: CreateGroupInput
): Promise<Group> {
  const response = await fetch(`${getApiBaseUrl()}/groups`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    credentials: "include",

    body: JSON.stringify(input),
  });

  const data: CreateGroupResponse = await response.json();

  if (!response.ok || !data.success || !data.group_id) {
    throw new Error(data.message ?? "Failed to create group");
  }

  return getGroup(data.group_id);
}


export async function getGroupMembers(
  groupId: number
): Promise<GroupMember[]> {
  const response = await fetch(
    `${getApiBaseUrl()}/groups/${groupId}/members`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const data: GroupMembersResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to load group members");
  }

  return (data.members ?? []).map(toGroupMember);
}

export async function getMembership(groupId: number): Promise<Membership> {
  const response = await fetch(
    `${getApiBaseUrl()}/groups/${groupId}/membership`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const data: MembershipResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to load membership status");
  }

  return { isMember: data.is_member, role: data.role };
}

export async function createJoinRequest(groupId: number): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/groups/${groupId}/join-requests`, {
    method: "POST",
    credentials: "include",
  });

  const data: CreateJoinRequestResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to send join request");
  }
}

export async function createGroupInvitation(
  groupId: number,
  invitedUserId: number
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/groups/${groupId}/invitations`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    credentials: "include",

    body: JSON.stringify({ invited_user_id: invitedUserId }),
  });

  const data: CreateGroupInvitationResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to send invitation");
  }
}
