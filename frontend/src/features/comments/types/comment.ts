export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  can_delete: boolean;
}
