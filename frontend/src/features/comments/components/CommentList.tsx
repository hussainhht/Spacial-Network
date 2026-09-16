"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import UserAvatar from "@/components/UserAvatar";
import { deleteComment } from "@/features/comments/api/comments";
import type { Comment } from "@/features/comments/types/comment";
import { getBackendBaseUrl } from "@/lib/api";
import { getDisplayName } from "@/lib/utils";
import styles from "./CommentList.module.css";

interface CommentListProps {
  comments: Comment[];
  onDeleted: (id: number) => void;
  showAuthors?: boolean;
}

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = Date.now();
    const diffSec = Math.floor((now - date.getTime()) / 1000);

    if (diffSec < 45) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function CommentList({
  comments,
  onDeleted,
  showAuthors = true,
}: CommentListProps) {
  if (comments.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon} aria-hidden="true">
          <AppIcon name="chat" width={19} height={19} />
        </span>
        <div>
          <p className={styles.emptyTitle}>No comments yet</p>
          <p className={styles.emptyText}>Start the conversation.</p>
        </div>
      </div>
    );
  }

  return (
    <ul className={styles.list} aria-label="Comments list">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onDeleted={onDeleted}
          showAuthor={showAuthors}
        />
      ))}
    </ul>
  );
}

function CommentItem({
  comment,
  onDeleted,
  showAuthor,
}: {
  comment: Comment;
  onDeleted: (id: number) => void;
  showAuthor: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const authorName = getDisplayName(
    comment.author.first_name,
    comment.author.last_name,
    comment.author.username,
  );

  async function handleDelete() {
    if (!window.confirm("Delete this comment? This cannot be undone.")) {
      return;
    }

    setError("");
    setDeleting(true);

    try {
      await deleteComment(comment.id);
      onDeleted(comment.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete comment");
      setDeleting(false);
    }
  }

  return (
    <li className={styles.item}>
      <Link
        href={`/profile/${encodeURIComponent(comment.author.username)}`}
        className={styles.avatarLink}
        aria-label={`View ${authorName}'s profile`}
      >
        <UserAvatar
          src={comment.author.profile_photo}
          firstName={comment.author.first_name}
          lastName={comment.author.last_name}
          username={comment.author.username}
          size="sm"
          alt=""
          className={styles.avatar}
        />
      </Link>

      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          {showAuthor && (
            <Link
              href={`/profile/${encodeURIComponent(comment.author.username)}`}
              className={styles.authorName}
            >
              {comment.is_owner ? `${authorName} (You)` : authorName}
            </Link>
          )}

          <time
            className={styles.timestamp}
            dateTime={comment.created_at}
            title={new Date(comment.created_at).toLocaleString()}
          >
            {formatTimeAgo(comment.created_at)}
          </time>

          {comment.can_delete && (
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete comment"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>

        <p className={styles.text} dir="auto">{comment.content}</p>

        {comment.image_url && (
          <div className={styles.imageWrapper}>
            <Image
              className={styles.image}
              src={`${getBackendBaseUrl()}${comment.image_url}`}
              alt=""
              width={500}
              height={300}
            />
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
