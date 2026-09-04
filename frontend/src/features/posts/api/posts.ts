// Client for the Go backend's Posts API (see backend/internal/posts).

import { apiRequest } from "@/lib/api/client";
import type { Post, PostInput } from "../types/post";

export function listPosts(): Promise<Post[]> {
  return apiRequest<Post[]>("/posts");
}

export function getPost(id: number): Promise<Post> {
  return apiRequest<Post>(`/posts/${id}`);
}

export function createPost(input: PostInput): Promise<void> {
  return apiRequest<void>("/posts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePost(id: number, input: PostInput): Promise<void> {
  return apiRequest<void>(`/posts/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deletePost(id: number): Promise<void> {
  return apiRequest<void>(`/posts/${id}`, {
    method: "DELETE",
  });
}
