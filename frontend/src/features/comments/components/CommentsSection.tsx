"use client";

import { useEffect, useState } from "react";
import { createComment, listComments } from "@/features/comments/api/comments";
import type { Comment } from "@/features/comments/types/comment";
import CommentForm from "./CommentForm";
import CommentList from "./CommentList";
import styles from "./CommentsSection.module.css";

interface CommentsSectionProps {
  postId: number;
  showAuthors?: boolean;
}

export default function CommentsSection({
  postId,
  showAuthors = false,
}: CommentsSectionProps) {
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
          setError(
            err instanceof Error ? err.message : "Failed to load comments",
          );
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

  const composerElement = <CommentForm onSubmit={handleCreate} />;

  return (
    <section className={`comments-section ${styles.container}`}>
      <hr className={styles.separator} aria-hidden="true" />

      <header className={styles.header}>
        <h3 className={styles.title}>Comments</h3>
        {!loading && !error && comments.length > 0 && (
          <span className={styles.count}>{comments.length}</span>
        )}
      </header>

      {loading && <p className={styles.loading}>Loading comments...</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <CommentList
          comments={comments}
          onDeleted={handleDeleted}
          showAuthors={showAuthors}
        />
      )}

      <div className={styles.composerSticky}>{composerElement}</div>
    </section>
  );
}
