// Types for the post interactions bar (comment / like / share).

/** A post's like state as seen by the requesting user. */
export interface LikeStatus {
  post_id: number;
  count: number;
  liked: boolean;
}

/** Where an in-site share is delivered. Never an external destination. */
export type ShareTarget = "user" | "group";

export interface ShareRequest {
  target: ShareTarget;
  /** The recipient user's id, or the group's id. */
  target_id: number;
  /** Optional note sent alongside the post link. */
  message?: string;
}

/** Confirmation that a share was accepted for delivery over chat. */
export interface ShareResult {
  post_id: number;
  target: ShareTarget;
  /** The relative in-site path that was messaged. */
  link: string;
}
