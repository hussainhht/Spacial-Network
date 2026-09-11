import type {
  FollowRequest,
  FollowStatus,
  Profile,
  ProfileUserSummary,
} from "../types/profile";

const API_BASE_URL = "http://localhost:8080/api";

interface ApiProfile {
  id: number;
  uuid?: string;
  username: string;
  age?: number;
  gender?: string;
  first_name: string;
  last_name: string;
  email?: string;
  profile_photo?: string;
  created_at?: string;
  updated_at?: string;
  is_private: boolean;
  can_view_full_profile?: boolean;
  nickname?: string;
  about_me?: string;
  date_of_birth?: string;
}

interface ProfileResponse {
  success: boolean;
  message?: string;
  profile?: ApiProfile;
}

interface ApiUserSummary {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  profile_photo?: string;
}

interface FollowListResponse {
  success: boolean;
  message?: string;
  users: ApiUserSummary[];
}

interface FollowResponse {
  success: boolean;
  message?: string;
}

interface FollowStatusResponse {
  success: boolean;
  message?: string;
  is_following: boolean;
  has_pending_request?: boolean;
}

interface UpdateProfilePrivacyResponse {
  success: boolean;
  message?: string;
  is_private: boolean;
}

interface ApiFollowRequest {
  id: number;
  requester: ApiUserSummary;
  status: string;
  created_at: string;
  updated_at: string;
}

interface FollowRequestsResponse {
  success: boolean;
  message?: string;
  requests: ApiFollowRequest[];
}

function toProfile(profile: ApiProfile): Profile {
  return {
    id: profile.id,
    uuid: profile.uuid ?? "",
    username: profile.username,
    age: profile.age ?? 0,
    gender: profile.gender ?? "",
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: profile.email ?? "",
    profilePhoto: profile.profile_photo,
    createdAt: profile.created_at ?? "",
    updatedAt: profile.updated_at ?? "",
    isPrivate: profile.is_private,
    canViewFullProfile:
      profile.can_view_full_profile ?? !profile.is_private,
    nickname: profile.nickname ?? "",
    aboutMe: profile.about_me ?? "",
    dateOfBirth: profile.date_of_birth ?? "",
  };
}

function toProfileUserSummary(user: ApiUserSummary): ProfileUserSummary {
  return {
    id: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    profilePhoto: user.profile_photo,
  };
}

function toFollowRequest(request: ApiFollowRequest): FollowRequest {
  return {
    id: request.id,
    requester: toProfileUserSummary(request.requester),
    status: request.status,
    createdAt: request.created_at,
    updatedAt: request.updated_at,
  };
}

export async function getProfileByUsername(username: string): Promise<Profile> {
  const response = await fetch(`${API_BASE_URL}/profiles/${username}`, {
    method: "GET",
    credentials: "include",
  });

  const data: ProfileResponse = await response.json();

  if (!response.ok || !data.success || !data.profile) {
    throw new Error(data.message ?? "Failed to load profile");
  }

  return toProfile(data.profile);
}

export async function followUser(username: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/profiles/${username}/follow`, {
    method: "POST",
    credentials: "include",
  });

  const data: FollowResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to follow user");
  }
}

export async function unfollowUser(username: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/profiles/${username}/follow`, {
    method: "DELETE",
    credentials: "include",
  });

  const data: FollowResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to unfollow user");
  }
}

export async function getFollowStatus(username: string): Promise<FollowStatus> {
  const response = await fetch(
    `${API_BASE_URL}/profiles/${username}/follow-status`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data: FollowStatusResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to load follow status");
  }

  return {
    isFollowing: data.is_following,
    hasPendingRequest: data.has_pending_request ?? false,
  };
}

export async function getFollowers(
  username: string,
): Promise<ProfileUserSummary[]> {
  const response = await fetch(
    `${API_BASE_URL}/profiles/${username}/followers`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data: FollowListResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to load followers");
  }

  return data.users.map(toProfileUserSummary);
}

export async function getFollowing(
  username: string,
): Promise<ProfileUserSummary[]> {
  const response = await fetch(
    `${API_BASE_URL}/profiles/${username}/following`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data: FollowListResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to load following");
  }

  return data.users.map(toProfileUserSummary);
}

export async function updateMyProfilePrivacy(
  isPrivate: boolean,
): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/users/me/privacy`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      is_private: isPrivate,
    }),
  });

  const data: UpdateProfilePrivacyResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to update profile privacy");
  }

  return data.is_private;
}

export async function getMyProfile(): Promise<Profile> {
  const response = await fetch(`${API_BASE_URL}/users/me`, {
    method: "GET",
    credentials: "include",
  });

  const data: ProfileResponse = await response.json();

  if (!response.ok || !data.success || !data.profile) {
    throw new Error(data.message ?? "Failed to load your profile");
  }

  return toProfile(data.profile);
}

export async function getPendingFollowRequests(): Promise<FollowRequest[]> {
  const response = await fetch(`${API_BASE_URL}/follow-requests`, {
    method: "GET",
    credentials: "include",
  });

  const data: FollowRequestsResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to load follow requests");
  }

  return data.requests.map(toFollowRequest);
}

export async function acceptFollowRequest(requestID: number): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/follow-requests/${requestID}/accept`,
    {
      method: "POST",
      credentials: "include",
    },
  );

  const data: FollowResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to accept follow request");
  }
}

export async function declineFollowRequest(requestID: number): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/follow-requests/${requestID}/decline`,
    {
      method: "POST",
      credentials: "include",
    },
  );

  const data: FollowResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "Failed to decline follow request");
  }
}
