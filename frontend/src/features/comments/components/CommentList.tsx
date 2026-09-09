"use client";

import Image from "next/image";
import { useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { deleteComment } from "@/features/comments/api/comments";
import type { Comment } from "@/features/comments/types/comment";
import { getBackendBaseUrl } from "@/lib/api";
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
      <p className={styles.emptyState}>
        No comments yet. Start the conversation.
      </p>
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
      <div className={styles.avatar} aria-hidden="true">
        <AppIcon name="user" width={15} height={15} />
      </div>

      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          {showAuthor && (
            <span className={styles.authorName}>
              {comment.is_owner ? "You" : `User #${comment.user_id}`}
            </span>
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

        <p className={styles.text}>{comment.content}</p>

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
