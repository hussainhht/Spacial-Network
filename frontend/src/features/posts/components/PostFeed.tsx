"use client";

import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFeed } from "@/features/posts/hooks/useFeed";
import type { FeedScope } from "@/features/posts/types/post";
import PostCard from "@/features/posts/components/PostCard";
import FeedFilter from "@/features/posts/components/FeedFilter";

const FEED_SCOPES: FeedScope[] = ["all", "following", "friends"];

function parseFeed(value: string | null): FeedScope {
  return (FEED_SCOPES as string[]).includes(value ?? "")
    ? (value as FeedScope)
    : "all";
}

const EMPTY_COPY: Record<FeedScope, { title: string; body: string }> = {
  all: {
    title: "No posts to show yet.",
    body: "Be the first to share something.",
  },
  following: {
    title: "No posts from people you follow yet.",
    body: "Follow people to see their posts here.",
  },
  friends: {
    title: "No posts from friends yet.",
    body: "Friends are people who follow each other back. Once you have a mutual follow, their posts will show up here.",
  },
};

export default function PostFeed({
  inlineDiscovery,
  stickyFilters = false,
}: {
  inlineDiscovery?: ReactNode;
  stickyFilters?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const feed = parseFeed(searchParams.get("feed"));

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
  } = useFeed(feed);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const filterAnchorRef = useRef<HTMLSpanElement>(null);
  const [filtersElevated, setFiltersElevated] = useState(false);

  useEffect(() => {
    if (unauthorized) router.push("/login");
  }, [unauthorized, router]);

  useEffect(() => {
    if (!stickyFilters) return;
    const anchor = filterAnchorRef.current;
    if (!anchor) return;
    const scrollPane = anchor.closest("#page-content");
    const observer = new IntersectionObserver(
      ([entry]) => setFiltersElevated(!entry.isIntersecting),
      { root: scrollPane },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [stickyFilters]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (
      !target ||
      loading ||
      loadingMore ||
      loadMoreError ||
      !hasMore ||
      posts.length === 0
    ) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      // Begin fetching several cards before the visible end so the next page
      // is usually ready before the reader reaches it.
      { rootMargin: "1200px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadMoreError, loading, loadingMore, posts.length]);

  function handleFeedChange(next: FeedScope) {
    if (next === feed) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("feed", next);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const empty = !loading && !error && posts.length === 0;
  const copy = EMPTY_COPY[feed];

  return (
    <div>
      {stickyFilters ? <span ref={filterAnchorRef} className="home-feed-filter-anchor" aria-hidden="true" /> : null}
      <div
        className={stickyFilters ? "home-feed-filter-sticky" : undefined}
        data-elevated={stickyFilters ? filtersElevated : undefined}
        data-motion-section
      >
        <FeedFilter active={feed} onChange={handleFeedChange} />
      </div>

      <div
        id="feed-tabpanel"
        role="tabpanel"
        aria-labelledby={`feed-tab-${feed}`}
        aria-busy={loading}
      >
        {loading && (
          <>
            <p className="sr-only" role="status" aria-live="polite">
              Loading posts...
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
            <h2>{copy.title}</h2>
            <p>{copy.body}</p>
          </div>
        )}

        {!loading && !error && posts.length > 0 && (
          <div className="posts-list" data-motion-list>
            {posts.map((post, index) => (
              <Fragment key={post.id}>
                <PostCard post={post} onDeleted={removePost} />
                {inlineDiscovery && index === Math.min(2, posts.length - 1)
                  ? inlineDiscovery
                  : null}
              </Fragment>
            ))}
          </div>
        )}

        {!loading && posts.length > 0 ? (
          <div className="feed-pagination" aria-live="polite">
            {loadingMore ? (
              <div className="feed-load-more" role="status">
                <span className="feed-load-more-spinner" aria-hidden="true" />
                Loading more posts…
              </div>
            ) : loadMoreError ? (
              <div className="feed-more-error" role="alert">
                <span>{loadMoreError}</span>
                <button type="button" className="feed-retry" onClick={() => void loadMore()}>
                  Try again
                </button>
              </div>
            ) : !hasMore ? (
              <p className="feed-end">You’re all caught up.</p>
            ) : null}
            {hasMore && !loadMoreError ? <div ref={loadMoreRef} className="feed-load-more-sentinel" aria-hidden="true" /> : null}
          </div>
        ) : null}

        {empty && inlineDiscovery}
      </div>
    </div>
  );
}
