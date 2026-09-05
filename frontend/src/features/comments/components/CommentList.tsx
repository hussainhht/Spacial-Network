"use client";

import { useState } from "react";
import { deleteComment } from "@/features/comments/api/comments";
import type { Comment } from "@/features/comments/types/comment";

interface CommentListProps {
  comments: Comment[];
  onDeleted: (id: number) => void;
}

export default function CommentList({ comments, onDeleted }: CommentListProps) {
  if (comments.length === 0) {
    return <p className="comment-empty">No comments yet.</p>;
  }

  return (
    <ul className="comment-list">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} onDeleted={onDeleted} />
      ))}
    </ul>
  );
}

function CommentItem({
  comment,
  onDeleted,
}: {
  comment: Comment;
  onDeleted: (id: number) => void;
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
      <p className="comment-content">{comment.content}</p>

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
