"use client";

import type { Ref } from "react";
import ExpandedPost, { type PostView } from "./ExpandedPost";
import type { Post } from "../../types/post";
import styles from "./OrbitalPostsFeed.module.css";

interface OrbitalPostProps {
  ref: Ref<HTMLDivElement>;
  post: Post;
  onDeleted: (id: number) => void;
  surfaceRef: Ref<HTMLDivElement>;
  selected: boolean;
  expanded: boolean;
  inactive: boolean;
  view: PostView;
  onOpen: (view: PostView) => void;
  onClose: () => void;
  onUpdated: (post: Post) => void;
}

export default function OrbitalPost({
  ref,
  surfaceRef,
  post,
  selected,
  expanded,
  inactive,
  view,
  onOpen,
  onClose,
  onDeleted,
  onUpdated,
}: OrbitalPostProps) {
  return (
    <>
      <div className={styles.orbitPlaceholder} data-expanded={expanded} aria-hidden="true" />
      <div ref={ref} className={styles.post} data-selected={selected} data-expanded={expanded}>
        <ExpandedPost
          ref={surfaceRef}
          post={post}
          expanded={expanded}
          inactive={inactive}
          view={view}
          onOpen={onOpen}
          onClose={onClose}
          onDeleted={onDeleted}
          onUpdated={onUpdated}
        />
      </div>
    </>
  );
}
