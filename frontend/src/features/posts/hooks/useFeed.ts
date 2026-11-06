"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listPosts } from "@/features/posts/api/posts";
import { ApiError } from "@/lib/api/errors";
import type { FeedScope, Post } from "@/features/posts/types/post";
import {
  peekRestorableSnapshot,
  saveFeedPosts,
} from "@/features/posts/lib/feedSnapshotCache";

interface FeedState {
  feed: FeedScope;
  posts: Post[];
  loading: boolean;
  error: string;
  unauthorized: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: string;
  // True when posts/pagination came from the snapshot cache, so the initial
  // fetch is skipped and the already-loaded pages are kept.
  restored: boolean;
}

function initialState(feed: FeedScope, ownerId: number | null): FeedState {
  const snapshot = peekRestorableSnapshot(ownerId, feed);
  if (snapshot) {
    return {
      feed,
      posts: snapshot.posts,
      loading: false,
      error: "",
      unauthorized: false,
      hasMore: snapshot.hasMore,
      loadingMore: false,
      loadMoreError: "",
      restored: true,
    };
  }
  return {
    feed,
    posts: [],
    loading: true,
    error: "",
    unauthorized: false,
    hasMore: true,
    loadingMore: false,
    loadMoreError: "",
    restored: false,
  };
}

const PAGE_SIZE = 20;

// useFeed loads the posts visible to the current user for a given feed
// scope (all/following/friends). Switching feed resets to a fresh loading
// state during render (rather than in an effect - see
// https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes),
// so a filter change never briefly shows the previous filter's results.
export function useFeed(feed: FeedScope, ownerId: number | null = null) {
  const [state, setState] = useState<FeedState>(() => initialState(feed, ownerId));
  const [attempt, setAttempt] = useState(0);
  const loadMoreInFlight = useRef(false);

  if (state.feed !== feed) {
    setState(initialState(feed, ownerId));
  }

  const restoredRef = useRef(state.restored);
  restoredRef.current = state.restored;

  useEffect(() => {
    if (state.feed !== feed || state.loading || state.error) return;
    saveFeedPosts(ownerId, feed, state.posts, state.hasMore);
  }, [feed, ownerId, state.feed, state.loading, state.error, state.posts, state.hasMore]);

  useEffect(() => {
    let cancelled = false;
    if (restoredRef.current && attempt === 0) return;

    async function load() {
      try {
        const data = await listPosts({ feed, limit: PAGE_SIZE });
        if (!cancelled) {
          setState((s) => ({
            ...s,
            restored: false,
            posts: data,
            loading: false,
            hasMore: data.length === PAGE_SIZE,
          }));
        }
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ApiError && err.status === 401) {
          setState((s) => ({ ...s, unauthorized: true, loading: false }));
          return;
        }

        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : "Failed to load posts",
          loading: false,
        }));
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [feed, attempt]);

  function removePost(id: number) {
    setState((s) => ({ ...s, posts: s.posts.filter((post) => post.id !== id) }));
  }

  function retry() {
    setState((s) => ({ ...s, loading: true, error: "" }));
    setAttempt((n) => n + 1);
  }

  const loadMore = useCallback(async () => {
    if (
      loadMoreInFlight.current ||
      state.feed !== feed ||
      state.loading ||
      state.loadingMore ||
      !state.hasMore ||
      state.posts.length === 0
    ) return;

    loadMoreInFlight.current = true;
    const lastPost = state.posts[state.posts.length - 1];
    setState((current) => ({
      ...current,
      loadingMore: true,
      loadMoreError: "",
    }));

    try {
      const nextPosts = await listPosts({
        feed,
        limit: PAGE_SIZE,
        before: lastPost.created_at,
        beforeId: lastPost.id,
      });
      setState((current) => {
        if (current.feed !== feed) return current;
        const known = new Set(current.posts.map((post) => post.id));
        const uniquePosts = nextPosts.filter((post) => !known.has(post.id));
        return {
          ...current,
          posts: [...current.posts, ...uniquePosts],
          loadingMore: false,
          // A full response containing no new IDs means the server did not
          // honor the cursor. Stop instead of repeatedly requesting it.
          hasMore:
            uniquePosts.length > 0 && nextPosts.length === PAGE_SIZE,
        };
      });
    } catch (err) {
      setState((current) => ({
        ...current,
        loadingMore: false,
        loadMoreError:
          err instanceof Error ? err.message : "Failed to load more posts",
      }));
    } finally {
      loadMoreInFlight.current = false;
    }
  }, [feed, state]);

  return {
    posts: state.posts,
    restored: state.restored,
    loading: state.loading,
    error: state.error,
    unauthorized: state.unauthorized,
    hasMore: state.hasMore,
    loadingMore: state.loadingMore,
    loadMoreError: state.loadMoreError,
    loadMore,
    retry,
    removePost,
  };
}
