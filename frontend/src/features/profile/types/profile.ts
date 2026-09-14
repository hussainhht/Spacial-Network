export interface Profile {
  id: number;
  uuid: string;
  username: string;
  age: number;
  gender: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePhoto?: string;
  createdAt: string;
  updatedAt: string;
  isPrivate: boolean;
  canViewFullProfile: boolean;
  nickname: string;
  aboutMe: string;
  dateOfBirth: string;
}

export type ProfileTab = "posts" | "about";

export interface ProfileUserSummary {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  profilePhoto?: string;
}

export interface FollowStatus {
  isFollowing: boolean;
  hasPendingRequest: boolean;
}

export interface FollowRequest {
  id: number;
  requester: ProfileUserSummary;
  status: string;
  createdAt: string;
  updatedAt: string;
}
