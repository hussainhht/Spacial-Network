export type PostVisibility = "public" | "followers" | "custom";

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
