"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { getPost } from "@/features/posts/api/posts";
import type { Post } from "@/features/posts/types/post";
import { getDisplayName } from "@/lib/utils";
import styles from "./PostSharePreview.module.css";

interface PostSharePreviewProps {
  postId: number;
}

function thumbnailUrl(post: Post): string | undefined {
  return post.media?.[0]?.url ?? post.image_url;
}

export default function PostSharePreview({ postId }: PostSharePreviewProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getPost(postId)
      .then((data) => {
        if (isMounted) setPost(data);
      })
      .catch(() => {
        if (isMounted) setFailed(true);
      });
    return () => {
      isMounted = false;
    };
  }, [postId]);

  if (failed) {
    return (
      <div className={styles.card}>
        <div className={styles.unavailable}>Post is no longer available</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className={styles.card}>
        <div className={styles.loading}>Loading post…</div>
      </div>
    );
  }

  const thumb = thumbnailUrl(post);

  return (
    <Link href={`/posts/${postId}`} className={styles.card}>
      {thumb ? (
        <img src={thumb} alt="" className={styles.thumb} />
      ) : (
        <div className={styles.thumbFallback}>
          <AppIcon name="posts" width={20} height={20} />
        </div>
      )}
      <div className={styles.body}>
        <span className={styles.author}>
          {getDisplayName(post.author.first_name, post.author.last_name, post.author.username)}
        </span>
        <span className={styles.title}>{post.title}</span>
      </div>
      <AppIcon name="chevronRight" width={16} height={16} className={styles.chevron} />
    </Link>
  );
}
