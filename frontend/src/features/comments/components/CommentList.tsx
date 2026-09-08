"use client";

import Image from "next/image";
import { useState } from "react";
import { deleteComment } from "@/features/comments/api/comments";
import type { Comment } from "@/features/comments/types/comment";
import { getBackendBaseUrl } from "@/lib/api";
import AppIcon from "@/components/layout/AppIcon";

interface CommentListProps {
  comments: Comment[];
  onDeleted: (id: number) => void;
  showAuthors?: boolean;
}

export default function CommentList({ comments, onDeleted, showAuthors = false }: CommentListProps) {
  if (comments.length === 0) {
    return <p className="comment-empty">No comments yet.</p>;
  }

  return (
    <ul className="comment-list">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} onDeleted={onDeleted} showAuthor={showAuthors} />
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
    <li className="comment-item">
      {showAuthor && (
        <header className="comment-author">
          <span aria-hidden="true"><AppIcon name="user" width={18} height={18} /></span>
          {comment.is_owner ? "You" : `User #${comment.user_id}`}
        </header>
      )}
      <p className="comment-content">{comment.content}</p>

      {comment.image_url && (
        <Image
          className="comment-image"
          src={`${getBackendBaseUrl()}${comment.image_url}`}
          alt=""
          width={600}
          height={338}
          style={{ width: "100%", height: "auto" }}
        />
      )}

      <footer className="comment-footer">
        <time dateTime={comment.created_at}>
          {new Date(comment.created_at).toLocaleString()}
        </time>

        {comment.is_owner && (
          <button type="button" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        )}
      </footer>

      {error && <p className="form-error">{error}</p>}
    </li>
  );
}
