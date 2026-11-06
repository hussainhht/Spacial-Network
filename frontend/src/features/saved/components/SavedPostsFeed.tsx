"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AppIcon from "@/components/layout/AppIcon";
import PostCard from "@/features/posts/components/PostCard";
import { useSavedPosts } from "@/features/saved/hooks/useSavedPosts";
import styles from "./SavedPostsFeed.module.css";

export default function SavedPostsFeed() {
  const router = useRouter();
  const {
    posts,
    loading,
    error,
    unauthorized,
    hasMore,
    loadingMore,
    loadMoreError,
    loadMore,
    retry,
    removePost,
  } = useSavedPosts();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (unauthorized) router.push("/login");
  }, [unauthorized, router]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loading || loadingMore || loadMoreError || !hasMore || posts.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "1200px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadMoreError, loading, loadingMore, posts.length]);

  const empty = !loading && !error && posts.length === 0;

  return (
    <>
      <div className={styles.header}>
        <h2 id="saved-posts-heading" className={styles.heading}>Saved Posts</h2>
        <p className={styles.privacy}>Only you can see what you save.</p>
      </div>

      <div aria-busy={loading}>
        {loading && (
          <>
            <p className="sr-only" role="status" aria-live="polite">
              Loading saved posts...
            </p>
            <div className="feed-skeleton" aria-hidden="true">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="feed-skeleton-card" key={index}>
                  <div className="feed-skeleton-header">
                    <span className="feed-skeleton-avatar" />
                    <span className="feed-skeleton-meta" />
                  </div>
                  <span className="feed-skeleton-title" />
                  <span className="feed-skeleton-line" />
                  <span className="feed-skeleton-line feed-skeleton-short" />
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && error && (
          <div className="feed-error" role="alert" aria-live="assertive">
            <span>{error}</span>
            <button type="button" className="feed-retry" onClick={retry}>
              Retry
            </button>
          </div>
        )}

        {empty && (
          <div className="feed-empty">
            <h2>No saved posts yet</h2>
            <p>Posts you save will appear here.</p>
            <Link href="/" className={styles.emptyAction}>
              <AppIcon name="home" width={16} height={16} />
              Back to Home
            </Link>
          </div>
        )}

        {!loading && !error && posts.length > 0 && (
          <div className="posts-list" data-motion-list>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDeleted={removePost}
                onSavedChange={(id, saved) => {
                  if (!saved) removePost(id);
                }}
              />
            ))}
          </div>
        )}

        {!loading && posts.length > 0 ? (
          <div className="feed-pagination" aria-live="polite">
            {loadingMore ? (
              <div className="feed-load-more" role="status">
                <span className="feed-load-more-spinner" aria-hidden="true" />
                Loading more saved posts…
              </div>
            ) : loadMoreError ? (
              <div className="feed-more-error" role="alert">
                <span>{loadMoreError}</span>
                <button type="button" className="feed-retry" onClick={() => void loadMore()}>
                  Try again
                </button>
              </div>
            ) : !hasMore ? (
              <p className="feed-end">That’s everything you’ve saved.</p>
            ) : null}
            {hasMore && !loadMoreError ? (
              <div ref={loadMoreRef} className="feed-load-more-sentinel" aria-hidden="true" />
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
