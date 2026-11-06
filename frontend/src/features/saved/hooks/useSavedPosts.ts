"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listSavedPosts } from "@/features/posts/api/posts";
import type { Post } from "@/features/posts/types/post";
import { ApiError } from "@/lib/api/errors";

const PAGE_SIZE = 20;

interface SavedPostsState {
  posts: Post[];
  loading: boolean;
  error: string;
  unauthorized: boolean;
  nextCursor: number | undefined;
  loadingMore: boolean;
  loadMoreError: string;
}

// useSavedPosts loads the current user's bookmarks, most recently saved
// first, a page at a time. The server rechecks visibility on every page, so
// posts that were deleted or are no longer accessible simply do not appear.
export function useSavedPosts() {
  const [state, setState] = useState<SavedPostsState>({
    posts: [],
    loading: true,
    error: "",
    unauthorized: false,
    nextCursor: undefined,
    loadingMore: false,
    loadMoreError: "",
  });
  const [attempt, setAttempt] = useState(0);
  const loadMoreInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const page = await listSavedPosts({ limit: PAGE_SIZE });
        if (!cancelled) {
          setState((s) => ({
            ...s,
            posts: page.posts,
            nextCursor: page.next_cursor,
            loading: false,
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
          error: err instanceof Error ? err.message : "Failed to load saved posts",
          loading: false,
        }));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    setAttempt((n) => n + 1);
  }, []);

  const removePost = useCallback((id: number) => {
    setState((s) => ({ ...s, posts: s.posts.filter((post) => post.id !== id) }));
  }, []);

  const { nextCursor, loading, loadingMore } = state;
  const loadMore = useCallback(async () => {
    if (loadMoreInFlight.current || loading || loadingMore || nextCursor === undefined) return;

    loadMoreInFlight.current = true;
    setState((s) => ({ ...s, loadingMore: true, loadMoreError: "" }));
    try {
      const page = await listSavedPosts({ limit: PAGE_SIZE, cursor: nextCursor });
      setState((s) => {
        const known = new Set(s.posts.map((post) => post.id));
        return {
          ...s,
          posts: [...s.posts, ...page.posts.filter((post) => !known.has(post.id))],
          nextCursor: page.next_cursor,
          loadingMore: false,
        };
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loadingMore: false,
        loadMoreError: err instanceof Error ? err.message : "Failed to load more saved posts",
      }));
    } finally {
      loadMoreInFlight.current = false;
    }
  }, [loading, loadingMore, nextCursor]);

  return {
    posts: state.posts,
    loading: state.loading,
    error: state.error,
    unauthorized: state.unauthorized,
    hasMore: state.nextCursor !== undefined,
    loadingMore: state.loadingMore,
    loadMoreError: state.loadMoreError,
    loadMore,
    retry,
    removePost,
  };
}
