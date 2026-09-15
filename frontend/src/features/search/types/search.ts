export interface UserResult {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  profile_photo: string;
  is_private: boolean;
  is_following: boolean;
}

export interface GroupResult {
  id: number;
  title: string;
  description: string;
  group_photo: string;
  member_count: number;
  membership_role: string;
}

export interface PostResult {
  id: number;
  title: string;
  content_snippet: string;
  author_id: number;
  author_username: string;
  author_photo: string;
  group_id?: number | null;
  group_title?: string;
  created_at: string;
}

export interface EventResult {
  id: number;
  group_id: number;
  group_title: string;
  title: string;
  description: string;
  event_time: string;
}

export interface SearchResults {
  query: string;
  users: UserResult[];
  groups: GroupResult[];
  posts: PostResult[];
  events: EventResult[];
}

export type SearchCategory =
  | "all"
  | "users"
  | "groups"
  | "posts"
  | "events"
  | "shortcuts";

export interface NavigationShortcut {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: "home" | "posts" | "groups" | "chat" | "user" | "orbit" | "plus" | "bell";
}
