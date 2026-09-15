"use client";

import { useEffect } from "react";
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

export default function PostFeed() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const feed = parseFeed(searchParams.get("feed"));

  const { posts, loading, error, unauthorized, retry, removePost } =
    useFeed(feed);

  useEffect(() => {
    if (unauthorized) router.push("/login");
  }, [unauthorized, router]);

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
      <FeedFilter active={feed} onChange={handleFeedChange} />

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
              <div className="feed-skeleton-card" />
              <div className="feed-skeleton-card" />
              <div className="feed-skeleton-card" />
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
          <div className="posts-list">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onDeleted={removePost} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
