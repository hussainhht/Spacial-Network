import type { Profile } from "../types/profile";

const API_BASE_URL = "http://localhost:8080/api";

interface ApiProfile {
  id: number;
  uuid: string;
  username: string;
  age: number;
  gender: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_photo?: string;
  created_at: string;
  updated_at: string;
  is_private: boolean;
}

interface ProfileResponse {
  success: boolean;
  message?: string;
  profile?: ApiProfile;
}

interface UpdateProfilePrivacyResponse {
  success: boolean;
  message?: string;
  is_private: boolean;
}

function toProfile(profile: ApiProfile): Profile {
  return {
    id: profile.id,
    uuid: profile.uuid,
    username: profile.username,
    age: profile.age,
    gender: profile.gender,
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: profile.email,
    profilePhoto: profile.profile_photo,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
    isPrivate: profile.is_private,
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
