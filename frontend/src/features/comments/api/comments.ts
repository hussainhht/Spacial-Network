// Client for the Go backend's Comments API (see backend/internal/comments).

import { apiRequest } from "@/lib/api/client";
import type { Comment, CommentCount } from "../types/comment";

export function listComments(postId: number): Promise<Comment[]> {
  return apiRequest<Comment[]>(`/posts/${postId}/comments`);
}

export function getCommentCount(postId: number): Promise<CommentCount> {
  return apiRequest<CommentCount>(`/posts/${postId}/comments/count`);
}

export function createComment(
  postId: number,
  content: string,
  image?: File | null,
): Promise<Comment> {
  const formData = new FormData();
  formData.append("content", content);
  if (image) {
    formData.append("image", image);
  }

  return apiRequest<Comment>(`/posts/${postId}/comments`, {
    method: "POST",
    body: formData,
  });
}

export function deleteComment(commentId: number): Promise<void> {
  return apiRequest<void>(`/comments/${commentId}`, {
    method: "DELETE",
  });
}
