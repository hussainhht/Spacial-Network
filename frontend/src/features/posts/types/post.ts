export type PostVisibility = "public" | "followers" | "custom";

// FeedScope narrows which authors' posts a feed request considers - it
// never bypasses a post's own visibility rules (see Post.visibility).
export type FeedScope = "all" | "following" | "friends";

export interface PostAuthor {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  profile_photo?: string;
}

export interface Post {
  id: number;
  user_id: number;
  author: PostAuthor;
  visibility: PostVisibility;
  title: string;
  content: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  // can_delete tells the client whether the requesting user may delete this
  // post - true for the owner, and also for the creator of the group it was
  // posted in.
  can_delete: boolean;
  // group_id is set when this post was created within a group.
  group_id?: number;
  // author_left_group is only set on a group post whose author is no
  // longer a member of that group.
  author_left_group?: boolean;
  // viewer_ids is only present when the requester owns a custom-visibility
  // post - the post's current allowed-viewer list.
  viewer_ids?: number[];
}

export interface PostInput {
  title: string;
  content: string;
  visibility: PostVisibility;
  // viewer_ids is only used (and required to have any effect) when
  // visibility is "custom".
  viewerIds: number[];
}

export interface NewPostInput extends PostInput {
  image?: File | null;
}

// NewGroupPostInput is the payload for creating a post within a group -
// group posts don't use the public/followers/custom visibility system.
export interface NewGroupPostInput {
  title: string;
  content: string;
  image?: File | null;
}
