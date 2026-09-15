// Client for the Go backend's Posts API (see backend/internal/posts).

import { apiRequest } from "@/lib/api/client";
import type {
  FeedScope,
  NewGroupPostInput,
  NewPostInput,
  Post,
  PostInput,
} from "../types/post";

export interface ListPostsOptions {
  // feed narrows the result to an author scope ("all" is the default on
  // the backend if omitted); post visibility rules always still apply.
  feed?: FeedScope;
  limit?: number;
}

export function listPosts(options?: ListPostsOptions): Promise<Post[]> {
  const params = new URLSearchParams();
  if (options?.feed) params.set("feed", options.feed);
  if (options?.limit != null) params.set("limit", String(options.limit));

  const query = params.toString();
  return apiRequest<Post[]>(`/posts${query ? `?${query}` : ""}`);
}

export function getPost(id: number): Promise<Post> {
  return apiRequest<Post>(`/posts/${id}`);
}

export function createPost(input: NewPostInput): Promise<Post> {
  const formData = new FormData();
  formData.append("title", input.title);
  formData.append("content", input.content);
  formData.append("visibility", input.visibility);
  if (input.visibility === "custom") {
    for (const id of input.viewerIds) {
      formData.append("viewer_ids", String(id));
    }
  }
  for (const file of input.media) {
    formData.append("media", file);
  }

  return apiRequest<Post>("/posts", {
    method: "POST",
    body: formData,
  });
}

export function updatePost(id: number, input: PostInput): Promise<void> {
  return apiRequest<void>(`/posts/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      title: input.title,
      content: input.content,
      visibility: input.visibility,
      viewer_ids: input.visibility === "custom" ? input.viewerIds : [],
    }),
  });
}

export function deletePost(id: number): Promise<void> {
  return apiRequest<void>(`/posts/${id}`, {
    method: "DELETE",
  });
}

export function listGroupPosts(groupId: number): Promise<Post[]> {
  return apiRequest<Post[]>(`/groups/${groupId}/posts`);
}

export function createGroupPost(
  groupId: number,
  input: NewGroupPostInput,
): Promise<Post> {
  const formData = new FormData();
  formData.append("title", input.title);
  formData.append("content", input.content);
  if (input.image) {
    formData.append("image", input.image);
  }

  return apiRequest<Post>(`/groups/${groupId}/posts`, {
    method: "POST",
    body: formData,
  });
}
