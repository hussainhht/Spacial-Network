"use client";

import Link from "next/link";
import { useState } from "react";
import { deletePost } from "@/features/posts/api/posts";
import type { Post } from "@/features/posts/types/post";
import AppIcon from "@/components/layout/AppIcon";
import styles from "./PostCard.module.css";
import PostAuthorLink from "./PostAuthorLink";
import PostMediaGrid from "./PostMediaGrid";

interface PostCardProps {
  post: Post;
  onDeleted?: (id: number) => void;
  preview?: boolean;
}

export default function PostCard({ post, onDeleted, preview = false }: PostCardProps) {
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
      onDeleted?.(post.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post");
      setDeleting(false);
    }
  }

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <PostAuthorLink author={post.author} disabled={preview} />
        <div className={styles.author}>
          <time
            className={styles.timestamp}
            dateTime={preview ? undefined : post.created_at}
            title={preview ? undefined : new Date(post.created_at).toLocaleString()}
          >
            {preview ? "Just now" : new Date(post.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {!preview && <><span aria-hidden="true"> · </span>
            {new Date(post.created_at).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}</>}
          </time>
        </div>
        {!preview && (post.is_owner || post.can_delete) && (
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
              {post.is_owner && <Link href={`/posts/${post.id}/edit`}>Edit post</Link>}
              {post.can_delete && (
                <button
                  className={styles.deleteAction}
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete post"}
                </button>
              )}
            </div>
          </details>
        )}
      </header>

      {(post.visibility === "followers" ||
        post.visibility === "custom" ||
        post.group_id != null ||
        post.author_left_group) && (
        <div className={styles.badges}>
          {post.visibility === "followers" && (
            <span className="post-badge">Followers only</span>
          )}
          {post.visibility === "custom" && (
            <span className="post-badge">Custom audience</span>
          )}
          {post.group_id != null && (
            <Link href={`/groups/${post.group_id}`} className="post-badge">
              Posted in group
            </Link>
          )}
          {post.author_left_group && (
            <span className="post-badge">Author left the group</span>
          )}
        </div>
      )}

      <div className={styles.body}>
        <h2 className={styles.title}>
          {preview ? post.title : <Link href={`/posts/${post.id}`}>{post.title}</Link>}
        </h2>
        <p className={styles.content}>{post.content}</p>
      </div>

      <PostMediaGrid media={post.media ?? (post.image_url ? [{ id: 0, url: post.image_url, type: "image", order: 0 }] : [])} />

      <footer className={styles.footer}>
        {preview ? <span className={styles.comments} aria-disabled="true">
          <AppIcon name="chat" width={17} height={17} />
          Comments
          <AppIcon name="arrow" width={15} height={15} />
        </span> : <Link className={styles.comments} href={`/posts/${post.id}`}>
          <AppIcon name="chat" width={17} height={17} />
          Comments
          <AppIcon name="arrow" width={15} height={15} />
        </Link>}
        <span className={styles.privacy}>
          {post.visibility === "public"
            ? "Public"
            : post.visibility === "followers"
              ? "Followers"
              : "Selected"}
        </span>
      </footer>

      {error && <p className={styles.error} role="alert" aria-live="assertive">{error}</p>}
    </article>
  );
}
