// Client for the Go backend's Share API (see backend/internal/share).
// Sharing is in-site only: the post link is delivered as a chat message to
// a user or a group, never to an external service.

import { apiRequest } from "@/lib/api/client";
import type { ShareRequest, ShareResult } from "../types/interactions";

export function sharePost(
  postId: number,
  request: ShareRequest,
): Promise<ShareResult> {
  return apiRequest<ShareResult>(`/posts/${postId}/share`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}
