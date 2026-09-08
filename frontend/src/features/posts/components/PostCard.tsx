"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { deletePost } from "@/features/posts/api/posts";
import type { Post } from "@/features/posts/types/post";
import { getBackendBaseUrl } from "@/lib/api";
import AppIcon from "@/components/layout/AppIcon";
import styles from "./PostCard.module.css";

interface PostCardProps {
  post: Post;
  onDeleted: (id: number) => void;
  onOpen?: () => void;
  onComments?: () => void;
  onEdit?: () => void;
}

export default function PostCard({ post, onDeleted, onOpen, onComments, onEdit }: PostCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!window.confirm("Delete this post? This cannot be undone.")) {
      return;
    }

    setError("");
    setDeleting(true);

    try {
      await deletePost(post.id);
      onDeleted(post.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post");
      setDeleting(false);
    }
  }

  return (
    <article className={`orbital-social-card ${styles.card}`}>
      <header className={styles.header}>
        <span className={styles.avatar} aria-hidden="true">
          <AppIcon name="user" width={20} height={20} />
        </span>
        <div className={styles.author}>
          <span className={styles.authorName}>
            {post.is_owner ? "You" : `User #${post.user_id}`}
          </span>
          <time
            className={styles.timestamp}
            dateTime={post.created_at}
            title={new Date(post.created_at).toLocaleString()}
          >
            {new Date(post.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            <span aria-hidden="true"> · </span>
            {new Date(post.created_at).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
        </div>
        {post.is_owner && (
          <details
            className={styles.actions}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                event.currentTarget.open = false;
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary aria-label="Post actions" title="Post actions">
              <span aria-hidden="true">•••</span>
            </summary>
            <div className={styles.actionMenu}>
              {onEdit ? (
                <button type="button" onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  onEdit();
                }}>Edit post</button>
              ) : <Link href={`/posts/${post.id}/edit`}>Edit post</Link>}
              <button
                className={styles.deleteAction}
                type="button"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete post"}
              </button>
            </div>
          </details>
        )}
      </header>

      <div className={styles.body}>
        <h2 className={styles.title}>
          {onOpen ? (
            <button className={styles.titleButton} type="button" onClick={onOpen}>
              {post.title}
            </button>
          ) : <Link href={`/posts/${post.id}`}>{post.title}</Link>}
        </h2>
        <p className={styles.content}>{post.content}</p>
      </div>

      {post.image_url && (
        <Image
          className={styles.image}
          src={`${getBackendBaseUrl()}${post.image_url}`}
          alt=""
          width={800}
          height={450}
          style={{ width: "100%", height: "auto" }}
        />
      )}

      <footer className={styles.footer}>
        {onComments ? <button className={styles.comments} type="button" onClick={onComments}>
          <AppIcon name="chat" width={17} height={17} />
          Comments
          <AppIcon name="arrow" width={15} height={15} />
        </button> : <Link className={styles.comments} href={`/posts/${post.id}`}>
          <AppIcon name="chat" width={17} height={17} />
          Comments
          <AppIcon name="arrow" width={15} height={15} />
        </Link>}
        <span className={styles.privacy}>
          {post.private ? "Private" : "Public"}
        </span>
      </footer>

      {error && <p className={styles.error} role="alert">{error}</p>}
    </article>
  );
}
