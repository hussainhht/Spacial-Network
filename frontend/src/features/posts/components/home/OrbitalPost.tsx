"use client";

import type { Ref } from "react";
import PostCard from "../PostCard";
import type { Post } from "../../types/post";
import styles from "./HomeOrbitalFeed.module.css";

interface OrbitalPostProps {
  ref: Ref<HTMLDivElement>;
  post: Post;
  onDeleted: (id: number) => void;
}

export default function OrbitalPost({ ref, post, onDeleted }: OrbitalPostProps) {
  return (
    <div ref={ref} className={styles.post}>
      <PostCard post={post} onDeleted={onDeleted} />
    </div>
  );
}
