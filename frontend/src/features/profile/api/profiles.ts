import type {
  FollowRequest,
  FollowStatus,
  Profile,
  ProfileUserSummary,
} from "../types/profile";
import { getApiUrl } from "@/lib/api";

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

export interface UpdateProfileDetailsInput {
  firstName: string;
  lastName: string;
  nickname: string;
  aboutMe: string;
  dateOfBirth: string;
}

export interface UpdateProfileAvatarInput {
  profilePhoto?: File | null;
  removePhoto?: boolean;
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

// The backend only guarantees a JSON body on routes it recognizes - an
// unmatched path (e.g. a stale/renamed endpoint) falls through to Go's
// default "404 page not found" plain-text response, and `response.json()`
// throws a confusing "Unexpected non-whitespace character" error on that.
// Read as text first and parse leniently so a non-JSON error body still
// produces a readable Error instead of a parse crash.
async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function getProfileByUsername(username: string): Promise<Profile> {
  const response = await fetch(getApiUrl(`/profiles/${username}`), {
    method: "GET",
    credentials: "include",
  });

  const data = await readJson<ProfileResponse>(response);

  if (!response.ok || !data?.success || !data.profile) {
    throw new Error(data?.message ?? `Failed to load profile (${response.status})`);
  }

  return toProfile(data.profile);
}

export async function followUser(username: string): Promise<void> {
  const response = await fetch(getApiUrl(`/profiles/${username}/follow`), {
    method: "POST",
    credentials: "include",
  });

  const data = await readJson<FollowResponse>(response);

  if (!response.ok || !data?.success) {
    throw new Error(data?.message ?? `Failed to follow user (${response.status})`);
  }
}

export async function unfollowUser(username: string): Promise<void> {
  const response = await fetch(getApiUrl(`/profiles/${username}/follow`), {
    method: "DELETE",
    credentials: "include",
  });

  const data = await readJson<FollowResponse>(response);

  if (!response.ok || !data?.success) {
    throw new Error(data?.message ?? `Failed to unfollow user (${response.status})`);
  }
}

export async function getFollowStatus(username: string): Promise<FollowStatus> {
  const response = await fetch(
    getApiUrl(`/profiles/${username}/follow-status`),
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data = await readJson<FollowStatusResponse>(response);

  if (!response.ok || !data?.success) {
    throw new Error(data?.message ?? `Failed to load follow status (${response.status})`);
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
    getApiUrl(`/profiles/${username}/followers`),
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data = await readJson<FollowListResponse>(response);

  if (!response.ok || !data?.success) {
    throw new Error(data?.message ?? `Failed to load followers (${response.status})`);
  }

  return data.users.map(toProfileUserSummary);
}

export async function getFollowing(
  username: string,
): Promise<ProfileUserSummary[]> {
  const response = await fetch(
    getApiUrl(`/profiles/${username}/following`),
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data = await readJson<FollowListResponse>(response);

  if (!response.ok || !data?.success) {
    throw new Error(data?.message ?? `Failed to load following (${response.status})`);
  }

  return data.users.map(toProfileUserSummary);
}

export async function updateMyProfilePrivacy(
  isPrivate: boolean,
): Promise<boolean> {
  const response = await fetch(getApiUrl("/users/me/privacy"), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      is_private: isPrivate,
    }),
  });

  const data = await readJson<UpdateProfilePrivacyResponse>(response);

  if (!response.ok || !data?.success) {
    throw new Error(data?.message ?? `Failed to update profile privacy (${response.status})`);
  }

  return data.is_private;
}

export async function updateMyProfileDetails(
  input: UpdateProfileDetailsInput,
): Promise<Profile> {
  const optionalValue = (value: string) => {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };

  const response = await fetch(getApiUrl("/users/me/profile"), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      nickname: optionalValue(input.nickname),
      about_me: optionalValue(input.aboutMe),
      date_of_birth: optionalValue(input.dateOfBirth),
    }),
  });

  const data = await readJson<ProfileResponse>(response);

  if (!response.ok || !data?.success || !data.profile) {
    throw new Error(data?.message ?? `Failed to update profile details (${response.status})`);
  }

  return toProfile(data.profile);
}

export async function updateMyProfileAvatar(
  input: UpdateProfileAvatarInput,
): Promise<Profile> {
  const formData = new FormData();

  if (input.profilePhoto) {
    formData.append("profilePhoto", input.profilePhoto);
  } else if (input.removePhoto) {
    formData.append("remove_photo", "true");
  } else {
    throw new Error("Choose a profile photo or remove the current one");
  }

  const response = await fetch(getApiUrl("/users/me/avatar"), {
    method: "PATCH",
    credentials: "include",
    body: formData,
  });

  const data = await readJson<ProfileResponse>(response);

  if (!response.ok || !data?.success || !data.profile) {
    throw new Error(data?.message ?? `Failed to update profile photo (${response.status})`);
  }

  return toProfile(data.profile);
}

export async function getMyProfile(): Promise<Profile> {
  const response = await fetch(getApiUrl("/users/me"), {
    method: "GET",
    credentials: "include",
  });

  const data = await readJson<ProfileResponse>(response);

  if (!response.ok || !data?.success || !data.profile) {
    throw new Error(data?.message ?? `Failed to load your profile (${response.status})`);
  }

  return toProfile(data.profile);
}

export async function getPendingFollowRequests(): Promise<FollowRequest[]> {
  const response = await fetch(getApiUrl("/follow-requests"), {
    method: "GET",
    credentials: "include",
  });

  const data = await readJson<FollowRequestsResponse>(response);

  if (!response.ok || !data?.success) {
    throw new Error(data?.message ?? `Failed to load follow requests (${response.status})`);
  }

  return data.requests.map(toFollowRequest);
}

export async function acceptFollowRequest(requestID: number): Promise<void> {
  const response = await fetch(
    getApiUrl(`/follow-requests/${requestID}/accept`),
    {
      method: "POST",
      credentials: "include",
    },
  );

  const data = await readJson<FollowResponse>(response);

  if (!response.ok || !data?.success) {
    throw new Error(data?.message ?? `Failed to accept follow request (${response.status})`);
  }
}

export async function declineFollowRequest(requestID: number): Promise<void> {
  const response = await fetch(
    getApiUrl(`/follow-requests/${requestID}/decline`),
    {
      method: "POST",
      credentials: "include",
    },
  );

  const data = await readJson<FollowResponse>(response);

  if (!response.ok || !data?.success) {
    throw new Error(data?.message ?? `Failed to decline follow request (${response.status})`);
  }
}
