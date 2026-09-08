"use client";

import type { Ref } from "react";
import CommentsSection from "@/features/comments/components/CommentsSection";
import { updatePost } from "../../api/posts";
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
        if (target.closest("a, button, input, textarea, select, summary, details, [role=button]")) return;
        if (window.getSelection()?.toString()) return;
        onOpen("post");
      }}
    >
      {expanded && (
        <div className={styles.expandedToolbar}>
          <button type="button" onClick={onClose} data-close-post>
            <span aria-hidden="true">←</span> Back to orbit
          </button>
          <span>{view === "edit" ? "Editing post" : "In your orbit"}</span>
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
                onUpdated({ ...post, title: input.title, content: input.content, private: input.private });
              }}
            />
            <button className={styles.cancelEdit} type="button" onClick={() => onOpen("post")}>Cancel editing</button>
          </div>
        )}
        {expanded && (
          <div className={styles.expandedComments} hidden={view === "edit"} tabIndex={-1} data-post-comments>
            <CommentsSection postId={post.id} showAuthors />
          </div>
        )}
      </div>
    </div>
  );
}
