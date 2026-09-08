"use client";

import { useState, type Ref } from "react";
import CommentsSection from "@/features/comments/components/CommentsSection";
import { deletePost, updatePost } from "../../api/posts";
import type { Post } from "../../types/post";
import PostCard from "../PostCard";
import PostForm from "../PostForm";
import styles from "./HomeOrbitalFeed.module.css";

export type PostView = "post" | "comments" | "edit";

interface ExpandedPostProps {
  ref: Ref<HTMLDivElement>;
  post: Post;
  expanded: boolean;
  inactive: boolean;
  view: PostView;
  onOpen: (view: PostView) => void;
  onClose: () => void;
  onDeleted: (id: number) => void;
  onUpdated: (post: Post) => void;
}

// This surface stays mounted inside its orbital wrapper. Flip moves the same
// DOM element in both directions; PostCard owns the shared post UI and actions.
export default function ExpandedPost({
  ref,
  post,
  expanded,
  inactive,
  view,
  onOpen,
  onClose,
  onDeleted,
  onUpdated,
}: ExpandedPostProps) {
  const [deleting, setDeleting] = useState(false);
  const [composerDock, setComposerDock] = useState<HTMLDivElement | null>(null);

  async function handleDelete() {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;

    setDeleting(true);
    try {
      await deletePost(post.id);
      onDeleted(post.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete post");
      setDeleting(false);
    }
  }

  return (
    <div
      ref={ref}
      className={styles.postSurface}
      data-expanded={expanded}
      inert={inactive}
      role={expanded ? "region" : undefined}
      aria-label={expanded ? `Expanded post: ${post.title}` : undefined}
      tabIndex={expanded ? -1 : undefined}
      onClick={(event) => {
        if (expanded || inactive) return;
        const target = event.target as HTMLElement;
        if (
          target.closest(
            "a, button, input, textarea, select, summary, details, [role=button]",
          )
        )
          return;
        if (window.getSelection()?.toString()) return;
        onOpen("post");
      }}
    >
      {expanded && (
        <div className={styles.expandedToolbar}>
          <button
            type="button"
            onClick={onClose}
            data-close-post
            className={styles.backButton}
            aria-label="Back to orbit"
          >
            <span aria-hidden="true" className={styles.backArrow}>
              ←
            </span>
            <span>Back to orbit</span>
          </button>

          {view === "edit" ? (
            <span className={styles.toolbarStatus}>Editing post</span>
          ) : post.is_owner ? (
            <details
              className={styles.toolbarActions}
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
              <summary
                aria-label="Post actions"
                title="Post actions"
                className={styles.toolbarSummary}
              >
                <span aria-hidden="true">•••</span>
              </summary>
              <div className={styles.actionMenu}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                    onOpen("edit");
                  }}
                >
                  Edit post
                </button>
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
          ) : null}
        </div>
      )}

      <div className={styles.expandedScroll} data-post-scroll>
        <div hidden={expanded && view === "edit"}>
          <PostCard
            post={post}
            onDeleted={onDeleted}
            onOpen={() => onOpen("post")}
            onComments={() => onOpen("comments")}
            onEdit={() => onOpen("edit")}
          />
        </div>

        {expanded && view === "edit" && (
          <div className={styles.expandedEditor} data-edit-post>
            <h2>Edit post</h2>
            <PostForm
              initialValues={post}
              submitLabel="Save changes"
              pendingLabel="Saving…"
              onSubmit={async (input) => {
                await updatePost(post.id, input);
                onUpdated({
                  ...post,
                  title: input.title,
                  content: input.content,
                  private: input.private,
                });
              }}
            />
            <button
              className={styles.cancelEdit}
              type="button"
              onClick={() => onOpen("post")}
            >
              Cancel editing
            </button>
          </div>
        )}

        {expanded && (
          <div
            className={styles.expandedComments}
            hidden={view === "edit"}
            tabIndex={-1}
            data-post-comments
          >
            <CommentsSection
              postId={post.id}
              showAuthors
              composerTarget={composerDock}
            />
          </div>
        )}
      </div>

      {expanded && (
        <div
          ref={setComposerDock}
          className={styles.expandedComposerDock}
          hidden={view === "edit"}
        />
      )}
    </div>
  );
}
