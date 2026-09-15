// Client for the Go backend's Likes API (see backend/internal/likes).

import { apiRequest } from "@/lib/api/client";
import type { LikeStatus } from "../types/interactions";

export function getLikeStatus(postId: number): Promise<LikeStatus> {
  return apiRequest<LikeStatus>(`/posts/${postId}/likes`);
}

export function likePost(postId: number): Promise<LikeStatus> {
  return apiRequest<LikeStatus>(`/posts/${postId}/likes`, {
    method: "POST",
  });
}

export function unlikePost(postId: number): Promise<LikeStatus> {
  return apiRequest<LikeStatus>(`/posts/${postId}/likes`, {
    method: "DELETE",
  });
}
