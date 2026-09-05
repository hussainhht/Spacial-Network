export interface Post {
  id: number;
  user_id: number;
  private: boolean;
  title: string;
  content: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
}

export interface PostInput {
  title: string;
  content: string;
  private: boolean;
}

export interface NewPostInput extends PostInput {
  image?: File | null;
}
