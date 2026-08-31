import type { Group , CreateGroupInput } from "../types/group";

const API_BASE_URL = "http://localhost:8080/api";

interface ApiGroup {
  id: number;
  creator_id: number;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
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