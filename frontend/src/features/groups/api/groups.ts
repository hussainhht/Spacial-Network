import type { Group , CreateGroupInput, GroupMember } from "../types/group";

const API_BASE_URL = "http://localhost:8080/api";

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
  group?: ApiGroup;
}

interface GetGroupResponse {
  success: boolean;
  message?: string;
  group?: ApiGroup;
}

export async function getGroup(groupId: number): Promise<Group> {
  const response = await fetch(`${API_BASE_URL}/groups/${groupId}`, {
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
  const response = await fetch(`${API_BASE_URL}/groups`, {
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
  const response = await fetch(`${API_BASE_URL}/groups`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    credentials: "include",

    body: JSON.stringify(input),
  });

  const data: CreateGroupResponse = await response.json();

  if (!response.ok || !data.success || !data.group) {
    throw new Error(data.message ?? "Failed to create group");
  }

  return toGroup(data.group);
}


export async function getGroupMembers(
  groupId: number
): Promise<GroupMember[]> {
  const response = await fetch(
    `${API_BASE_URL}/groups/${groupId}/members`,
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