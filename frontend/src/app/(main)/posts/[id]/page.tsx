"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppIcon from "@/components/layout/AppIcon";
import PageTransition from "@/components/transitions/PageTransition";
import { getPost } from "@/features/posts/api/posts";
import { ApiError } from "@/lib/api/errors";
import type { Post } from "@/features/posts/types/post";
import CommentsSection from "@/features/comments/components/CommentsSection";
import PostCard from "@/features/posts/components/PostCard";
import styles from "./PostDetailPage.module.css";

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const postId = Number(params.id);

  const validId = Number.isFinite(postId);

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(validId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!validId) return;

    let cancelled = false;

    async function load() {
      try {
        const data = await getPost(postId);
        if (!cancelled) setPost(data);
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to load post");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [postId, validId, router]);

  return (
    <PageTransition>
      <main className={`posts-page ${styles.page}`}>
        <div className={styles.container} data-motion-section>
          <Link href="/" className={`back-link ${styles.backLink}`}>
            <AppIcon name="arrowLeft" width={17} height={17} />
            <span>Back to home</span>
          </Link>

          {!validId && <p className="form-error">Invalid post id</p>}
          {loading && (
            <div
              className="feed-skeleton-card"
              style={{ minHeight: "480px" }}
              aria-label="Loading post..."
            />
          )}
          {error && <p className="form-error">{error}</p>}

          {post && (
            <PostCard post={post} detail onDeleted={() => router.push("/")}>
              <CommentsSection postId={post.id} showAuthors />
            </PostCard>
          )}
        </div>
      </main>
    </PageTransition>
  );
}
