import type { EventResponseStatus } from "./group";

export interface ApiGroup {
  id: number;
  creator_id: number;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  creator_username: string;
  member_count: number;
  membership_role?: string;
  has_pending_join_request: boolean;
  has_pending_invitation: boolean;
}

export interface ApiGroupMember {
  user_id: number;
  username: string;
  role: string;
  joined_at: string;
  avatar?: string;
}

export interface ApiInviteCandidate {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  avatar?: string;
}

export interface ApiGroupInvitation {
  id: number;
  group_id: number;
  invited_by: number;
  invited_user_id: number;
  status: string;
  created_at: string;
  updated_at: string;
  group_title: string;
  inviter_username: string;
}

export interface ApiGroupJoinRequest {
  id: number;
  group_id: number;
  user_id: number;
  username: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ApiEvent {
  id: number;
  group_id: number;
  created_by: number;
  title: string;
  description: string;
  event_time: string;
  created_at: string;
  updated_at: string;
  current_user_response: EventResponseStatus | null;
  going_count: number;
  not_going_count: number;
}
