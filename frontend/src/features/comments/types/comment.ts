export interface CommentAuthor {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  profile_photo?: string;
}

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  author: CommentAuthor;
  content: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  can_delete: boolean;
}

/** A post's comment count as last read from the server. */
export interface CommentCount {
  post_id: number;
  count: number;
}
