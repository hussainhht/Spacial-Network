"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cloneElement, isValidElement, useEffect, useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useActionFeedback } from "@/components/feedback/ActionFeedbackProvider";
import { getCommentCount } from "@/features/comments/api/comments";
import { getLikeStatus, likePost, unlikePost } from "@/features/interactions/api/likes";
import InteractionsBar from "@/features/interactions/components/InteractionsBar";
import ShareModal from "@/features/interactions/components/ShareModal";
import type { LikeStatus } from "@/features/interactions/types/interactions";
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
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [likeStatus, setLikeStatus] = useState<LikeStatus | null>(null);
  const [commentCount, setCommentCount] = useState<number | undefined>(undefined);
  const [sharing, setSharing] = useState(false);
  const postHref = `/posts/${post.id}`;
  const titleId = preview ? undefined : `post-title-${post.id}`;
  const visibility = visibilityPresentation[post.visibility];
  const { notify } = useActionFeedback();

  useEffect(() => {
    if (preview) return;
    let isMounted = true;
    getLikeStatus(post.id)
      .then((status) => {
        if (isMounted) setLikeStatus(status);
      })
      .catch(() => {
        // Like state is a non-critical enhancement; leave the bar at its
        // zero-state defaults if the fetch fails.
      });
    return () => {
      isMounted = false;
    };
  }, [post.id, preview]);

  useEffect(() => {
    if (preview) return;
    let isMounted = true;
    getCommentCount(post.id)
      .then((data) => {
        if (isMounted) setCommentCount(data.count);
      })
      .catch(() => {
        // Comment count is a non-critical enhancement; leave the bar
        // without a number if the fetch fails.
      });
    return () => {
      isMounted = false;
    };
  }, [post.id, preview]);

  // When CommentsSection is rendered as children (the post detail page),
  // it tracks the live comment list - inject a callback so adding or
  // deleting a comment there keeps this count in sync without a refetch.
  const childrenWithCommentSync = isValidElement(children)
    ? cloneElement(children, { onCountChange: setCommentCount } as object)
    : children;

  async function handleDelete() {
    setError("");
    setDeleting(true);
    try {
      await deletePost(post.id);
      setDeleteDialogOpen(false);
      onDeleted?.(post.id);
      notify("Post deleted.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete post";
      setError(message);
      notify(message, "error");
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
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.closest("details")?.removeAttribute("open");
                    setDeleteDialogOpen(true);
                  }}
                  disabled={deleting}
                >
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
        <InteractionsBar
          key={likeStatus ? "loaded" : "loading"}
          postId={post.id}
          commentCount={commentCount}
          likeCount={likeStatus?.count}
          liked={likeStatus?.liked}
          onLike={async (next) => {
            await (next ? likePost(post.id) : unlikePost(post.id));
          }}
          onComment={() => router.push(detail ? "#comments" : `${postHref}#comments`)}
          onShare={preview ? undefined : () => setSharing(true)}
          preview={preview}
        />
      </footer>

      {error && <p className={styles.error} role="alert" aria-live="assertive">{error}</p>}
      {sharing && <ShareModal postId={post.id} onClose={() => setSharing(false)} />}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete post?"
        description="This post and its conversation will be permanently removed."
        confirmLabel="Delete post"
        busyLabel="Deleting…"
        busy={deleting}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
      />
      {childrenWithCommentSync}
    </article>
  );
}
