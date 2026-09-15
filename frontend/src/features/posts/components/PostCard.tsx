"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { deletePost } from "@/features/posts/api/posts";
import type { Post, PostVisibility } from "@/features/posts/types/post";
import { formatDateTime, timeAgo } from "@/lib/utils";
import styles from "./PostCard.module.css";
import PostAuthorLink from "./PostAuthorLink";
import PostMediaGrid from "./PostMediaGrid";

interface PostCardProps {
  post: Post;
  onDeleted?: (id: number) => void;
  preview?: boolean;
  detail?: boolean;
  children?: ReactNode;
}

const visibilityPresentation: Record<
  PostVisibility,
  { label: string; icon: "globe" | "groups" | "lock" }
> = {
  public: { label: "Public", icon: "globe" },
  followers: { label: "Followers", icon: "groups" },
  custom: { label: "Selected audience", icon: "lock" },
};

function postMedia(post: Post) {
  return post.media ?? (post.image_url
    ? [{ id: 0, url: post.image_url, type: "image" as const, order: 0 }]
    : []);
}

export default function PostCard({ post, onDeleted, preview = false, detail = false, children }: PostCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const postHref = `/posts/${post.id}`;
  const titleId = preview ? undefined : `post-title-${post.id}`;
  const visibility = visibilityPresentation[post.visibility];

  async function handleDelete() {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
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
    <article
      id={preview ? undefined : `post-${post.id}`}
      className={`${styles.card} ${detail ? styles.detail : styles.feed} ${preview ? styles.composerPreview : ""}`}
      aria-labelledby={titleId}
    >
      {!detail && !preview && (
        <Link href={postHref} className={styles.cardLink} aria-labelledby={titleId} />
      )}

      <header className={styles.header}>
        <PostAuthorLink
          author={post.author}
          disabled={preview}
          meta={
            <>
              <span aria-hidden="true">·</span>
              <time
                dateTime={preview ? undefined : post.created_at}
                title={preview ? undefined : formatDateTime(post.created_at)}
                suppressHydrationWarning
              >
                {preview ? "Just now" : timeAgo(post.created_at)}
              </time>
            </>
          }
        />

        {!preview && (post.is_owner || post.can_delete) && (
          <details
            className={styles.actions}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary aria-label="Post actions" title="Post actions">
              <AppIcon name="dots" width={19} height={19} />
            </summary>
            <div className={styles.actionMenu}>
              {post.is_owner && <Link href={`${postHref}/edit`}>Edit post</Link>}
              {post.can_delete && (
                <button type="button" onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete post"}
                </button>
              )}
            </div>
          </details>
        )}
      </header>

      <div className={styles.context} aria-label="Post context">
        {post.group_id != null && (
          <Link href={`/groups/${post.group_id}`} className={styles.contextItem}>
            <AppIcon name="groups" width={14} height={14} />
            <span>Posted in {post.group_title || "group"}</span>
          </Link>
        )}
        <span className={styles.contextItem}>
          <AppIcon name={visibility.icon} width={14} height={14} />
          {post.group_id != null ? "Group members" : visibility.label}
        </span>
        {post.author_left_group && <span className={styles.contextNote}>Author left the group</span>}
      </div>

      <div className={styles.body}>
        {detail ? (
          <h1 id={titleId} className={styles.title}>{post.title}</h1>
        ) : (
          <h2 id={titleId} className={styles.title}>{post.title}</h2>
        )}
        <p className={styles.content}>{post.content}</p>
      </div>

      <PostMediaGrid media={postMedia(post)} preview={!detail} />

      <footer className={styles.footer}>
        {preview ? (
          <span className={styles.comments} aria-disabled="true">
            <AppIcon name="chat" width={17} height={17} /> Comments
          </span>
        ) : (
          <Link className={styles.comments} href={detail ? "#comments" : `${postHref}#comments`}>
            <AppIcon name="chat" width={17} height={17} />
            <span>Comments</span>
            {!detail && <AppIcon name="arrow" width={14} height={14} />}
          </Link>
        )}
      </footer>

      {error && <p className={styles.error} role="alert" aria-live="assertive">{error}</p>}
      {children}
    </article>
  );
}
