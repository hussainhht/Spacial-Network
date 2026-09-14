import { getApiBaseUrl, getUploadsBaseUrl } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import type {
  Group,
  CreateGroupInput,
  UpdateGroupInput,
  GroupMember,
  Membership,
  InviteCandidate,
  GroupInvitation,
  GroupJoinRequest,
  GroupEvent,
  CreateEventInput,
  EventResponseStatus,
  EventResponseUser,
} from "../types/group";

import type {
  ApiGroup,
  ApiGroupMember,
  ApiInviteCandidate,
  ApiGroupInvitation,
  ApiGroupJoinRequest,
  ApiEvent,
} from "../types/api";

interface Envelope {
  success: boolean;
  message?: string;
}

// Groups uses {success,message}, unlike the shared client's {error} envelope.
// Keep status and the server's domain message, including conflicts and authorization.
async function groupRequest<T extends Envelope>(
  path: string,
  body?: unknown,
  method = "GET",
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      ...(body === undefined
        ? {}
        : body instanceof FormData
          ? { body }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
    });
  } catch {
    throw new ApiError(
      "Could not connect to server. Checking the latest group state…",
      0,
    );
  }
  let data: T;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "The server returned an unreadable response. Check the latest group state before retrying.",
      response.status,
    );
  }
  if (!response.ok || !data.success)
    throw new ApiError(
      data.message ?? "Unable to complete the group request",
      response.status,
    );
  return data;
}

const post = (path: string, body?: unknown) =>
  groupRequest<Envelope>(path, body, "POST").then(() => undefined);

function toGroup(g: ApiGroup): Group {
  return {
    id: g.id,
    creatorId: g.creator_id,
    title: g.title,
    description: g.description,
    privacy: g.privacy,
    groupPhoto: g.group_photo,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
    creatorUsername: g.creator_username,
    memberCount: g.member_count,
    membershipRole: g.membership_role,
    hasPendingJoinRequest: g.has_pending_join_request,
    hasPendingInvitation: g.has_pending_invitation,
  };
}

export async function getGroup(groupId: number): Promise<Group> {
  const data = await groupRequest<Envelope & { group: ApiGroup }>(
    `/groups/${groupId}`,
  );
  return toGroup(data.group);
}

function groupsQuery(limit: number, offset: number, search: string): string {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (search) params.set("search", search);
  return params.toString();
}

export async function getGroups(
  limit = 20,
  offset = 0,
  search = "",
): Promise<Group[]> {
  const data = await groupRequest<Envelope & { groups?: ApiGroup[] }>(
    `/groups?${groupsQuery(limit, offset, search)}`,
  );
  return (data.groups ?? []).map(toGroup);
}

// Groups the current session's user actually belongs to (creator or
// member) - backs the "My Groups" section on /groups.
export async function getMyGroups(
  limit = 20,
  offset = 0,
  search = "",
): Promise<Group[]> {
  const data = await groupRequest<Envelope & { groups?: ApiGroup[] }>(
    `/groups/mine?${groupsQuery(limit, offset, search)}`,
  );
  return (data.groups ?? []).map(toGroup);
}

export async function createGroup(input: CreateGroupInput): Promise<Group> {
  const formData = new FormData();
  formData.append("title", input.title);
  formData.append("description", input.description);
  formData.append("privacy", input.privacy);
  if (input.photo) {
    formData.append("groupPhoto", input.photo);
  }

  const data = await groupRequest<Envelope & { group_id: number }>(
    "/groups",
    formData,
    "POST",
  );
  return getGroup(data.group_id);
}

export async function updateGroup(
  groupId: number,
  input: UpdateGroupInput,
): Promise<Group> {
  const formData = new FormData();
  formData.append("title", input.title);
  formData.append("description", input.description);
  if (input.photo) {
    formData.append("groupPhoto", input.photo);
  } else if (input.removePhoto) {
    formData.append("remove_photo", "true");
  }

  const data = await groupRequest<Envelope & { group: ApiGroup }>(
    `/groups/${groupId}`,
    formData,
    "PUT",
  );
  return toGroup(data.group);
}

export async function getGroupMembers(groupId: number): Promise<GroupMember[]> {
  const data = await groupRequest<Envelope & { members?: ApiGroupMember[] }>(
    `/groups/${groupId}/members`,
  );
  return (data.members ?? []).map((m) => ({
    userId: m.user_id,
    username: m.username,
    role: m.role,
    joinedAt: m.joined_at,
    avatar: m.avatar,
  }));
}

export async function getMembership(groupId: number): Promise<Membership> {
  const data = await groupRequest<
    Envelope & {
      is_member: boolean;
      role?: string;
      has_pending_join_request: boolean;
    }
  >(`/groups/${groupId}/membership`);
  return {
    isMember: data.is_member,
    role: data.role,
    hasPendingJoinRequest: data.has_pending_join_request,
  };
}

export async function getPendingInvitations(): Promise<GroupInvitation[]> {
  const data = await groupRequest<
    Envelope & { invitations?: ApiGroupInvitation[] }
  >("/group-invitations");
  return (data.invitations ?? []).map((i) => ({
    id: i.id,
    groupId: i.group_id,
    invitedBy: i.invited_by,
    invitedUserId: i.invited_user_id,
    status: i.status,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    groupTitle: i.group_title,
    groupPrivacy: i.group_privacy,
    inviterUsername: i.inviter_username,
  }));
}

export async function getPendingJoinRequests(
  groupId: number,
): Promise<GroupJoinRequest[]> {
  const data = await groupRequest<
    Envelope & { join_requests?: ApiGroupJoinRequest[] }
  >(`/groups/${groupId}/join-requests`);
  return (data.join_requests ?? []).map((r) => ({
    id: r.id,
    groupId: r.group_id,
    userId: r.user_id,
    username: r.username,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function toGroupEvent(e: ApiEvent): GroupEvent {
  return {
    id: e.id,
    groupId: e.group_id,
    createdBy: e.created_by,
    title: e.title,
    description: e.description,
    eventTime: e.event_time,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
    currentUserResponse: e.current_user_response ?? null,
    goingCount: e.going_count,
    notGoingCount: e.not_going_count,
  };
}

export async function getGroupEvents(groupId: number): Promise<GroupEvent[]> {
  const data = await groupRequest<Envelope & { events?: ApiEvent[] }>(
    `/groups/${groupId}/events`,
  );
  return (data.events ?? []).map(toGroupEvent);
}

export async function createGroupEvent(
  groupId: number,
  input: CreateEventInput,
): Promise<void> {
  await groupRequest<Envelope & { event_id?: number }>(
    `/groups/${groupId}/events`,
    {
      title: input.title,
      description: input.description,
      event_time: input.eventTime,
    },
    "POST",
  );
}

export async function respondToGroupEvent(
  groupId: number,
  eventId: number,
  response: EventResponseStatus,
): Promise<GroupEvent> {
  const data = await groupRequest<Envelope & { event: ApiEvent }>(
    `/groups/${groupId}/events/${eventId}/response`,
    { response },
    "PUT",
  );
  return toGroupEvent(data.event);
}

export const createJoinRequest = (id: number) =>
  post(`/groups/${id}/join-requests`);
export const createGroupInvitation = (groupId: number, userId: number) =>
  post(`/groups/${groupId}/invitations`, { invited_user_id: userId });
export const acceptJoinRequest = (groupId: number, id: number) =>
  post(`/groups/${groupId}/join-requests/${id}/accept`);
export const rejectJoinRequest = (groupId: number, id: number) =>
  post(`/groups/${groupId}/join-requests/${id}/reject`);
export const acceptGroupInvitation = (id: number) =>
  post(`/group-invitations/${id}/accept`);
export const declineGroupInvitation = (id: number) =>
  post(`/group-invitations/${id}/decline`);
export const removeMember = (groupId: number, memberId: number) =>
  groupRequest<Envelope>(
    `/groups/${groupId}/members/${memberId}`,
    undefined,
    "DELETE",
  ).then(() => undefined);
export const deleteGroup = (groupId: number) =>
  groupRequest<Envelope>(`/groups/${groupId}`, undefined, "DELETE").then(
    () => undefined,
  );

export function toInviteCandidate(user: ApiInviteCandidate): InviteCandidate {
  return {
    id: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    avatar: user.avatar,
  };
}

export function avatarUrl(photo?: string): string | undefined {
  if (!photo) return undefined;
  return /^https?:\/\//.test(photo) ? photo : `${getUploadsBaseUrl()}/${photo}`;
}

export async function getEventResponses(
  groupId: number,
  eventId: number,
): Promise<EventResponseUser[]> {
  const data = await groupRequest<
    Envelope & {
      responses: {
        user_id: number;
        username: string;
        avatar?: string;
        response: EventResponseStatus;
      }[];
    }
  >(`/groups/${groupId}/events/${eventId}/responses`);
  return data.responses.map((user) => ({
    userId: user.user_id,
    username: user.username,
    avatar: user.avatar,
    response: user.response,
  }));
}
