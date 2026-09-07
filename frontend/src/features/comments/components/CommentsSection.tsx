"use client";

import { useEffect, useState } from "react";
import { createComment, listComments } from "@/features/comments/api/comments";
import type { Comment } from "@/features/comments/types/comment";
import CommentForm from "./CommentForm";
import CommentList from "./CommentList";

interface CommentsSectionProps {
  postId: number;
}

export default function CommentsSection({ postId }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await listComments(postId);
        if (!cancelled) setComments(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load comments");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function handleCreate(content: string, image?: File | null) {
    const comment = await createComment(postId, content, image);
    setComments((current) => [...current, comment]);
  }

  function handleDeleted(id: number) {
    setComments((current) => current.filter((comment) => comment.id !== id));
  }

  return (
    <section className="comments-section">
      <h2>Comments</h2>

      {loading && <p>Loading comments...</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && (
        <CommentList comments={comments} onDeleted={handleDeleted} />
      )}

      <CommentForm onSubmit={handleCreate} />
    </section>
  );
}
