"use client";

import Link from "next/link";
import { useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import styles from "./InteractionsBar.module.css";

interface InteractionsBarProps {
  postId: number;
  /** Number of comments on the post, when the caller already knows it. */
  commentCount?: number;
  /**
   * The post's like count as last read from the server. Read once, as the
   * bar's initial state - if the caller loads this asynchronously after
   * mount, give the bar a `key` that changes once the real value arrives
   * so it remounts with it, rather than passing an updated prop in place.
   */
  likeCount?: number;
  /** Whether the viewer has already liked the post. See likeCount. */
  liked?: boolean;
  /**
   * Called when the viewer toggles the like, with the state they are
   * toggling *to*. The bar updates optimistically and rolls back if this
   * rejects, so a handler that calls the Likes API needs no extra state of
   * its own.
   */
  onLike?: (liked: boolean) => void | Promise<void>;
  /**
   * Called when the viewer opens the comments. When omitted, the comment
   * icon links to the post page, where CommentsSection already lives.
   */
  onComment?: () => void;
  /**
   * Called when the viewer starts a share. Sharing is in-site only, so the
   * caller is expected to open a picker for a direct message or a group
   * chat and then post to the Share API.
   */
  onShare?: () => void;
  /** Renders the bar inert, matching PostCard's preview mode. */
  preview?: boolean;
  /** Gives the post detail view larger, more explicit interaction controls. */
  detail?: boolean;
}

export default function InteractionsBar({
  postId,
  commentCount,
  likeCount = 0,
  liked = false,
  onLike,
  onComment,
  onShare,
  preview = false,
  detail = false,
}: InteractionsBarProps) {
  const [isLiked, setIsLiked] = useState(liked);
  const [count, setCount] = useState(likeCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleLike() {
    if (preview || pending) return;

    const next = !isLiked;
    // Optimistic: flip first so the button responds immediately, and
    // remember what to restore if the handler rejects.
    const previousLiked = isLiked;
    const previousCount = count;

    setError("");
    setIsLiked(next);
    setCount((current) => current + (next ? 1 : -1));
    setPending(true);

    try {
      await onLike?.(next);
    } catch (err) {
      setIsLiked(previousLiked);
      setCount(previousCount);
      setError(err instanceof Error ? err.message : "Failed to update like");
    } finally {
      setPending(false);
    }
  }

  const commentLabel =
    commentCount === undefined ? "Comments" : `${commentCount}`;

  const commentIcon = <AppIcon name="chat" width={17} height={17} />;

  return (
    <div className={`${styles.bar} ${detail ? styles.detail : ""}`}>
      {onComment || preview ? (
        <button
          type="button"
          className={styles.action}
          onClick={onComment}
          disabled={preview}
          aria-label="Comments"
        >
          {commentIcon}
          <span className={styles.label}>{commentLabel}</span>
        </button>
      ) : (
        <Link
          className={styles.action}
          href={`/posts/${postId}`}
          aria-label="Comments"
        >
          {commentIcon}
          <span className={styles.label}>{commentLabel}</span>
        </Link>
      )}

      <button
        type="button"
        className={`${styles.action} ${isLiked ? styles.liked : ""}`}
        onClick={handleLike}
        disabled={preview || pending}
        aria-pressed={isLiked}
        aria-label={isLiked ? "Unlike" : "Like"}
      >
        <AppIcon
          name="heart"
          width={17}
          height={17}
          fill={isLiked ? "currentColor" : "none"}
        />
        <span className={styles.label}>{count > 0 ? count : "Like"}</span>
      </button>

      <button
        type="button"
        className={styles.action}
        onClick={onShare}
        disabled={preview || !onShare}
        aria-label="Share to a chat"
      >
        <AppIcon name="share" width={16} height={16} />
        <span className={styles.label}>Share</span>
      </button>

      {error && (
        <p className={styles.error} role="alert" aria-live="assertive">
          {error}
        </p>
      )}
    </div>
  );
}
