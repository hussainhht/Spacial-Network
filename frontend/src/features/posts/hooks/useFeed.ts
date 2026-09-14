"use client";

import { useEffect, useState } from "react";
import { listPosts } from "@/features/posts/api/posts";
import { ApiError } from "@/lib/api/errors";
import type { FeedScope, Post } from "@/features/posts/types/post";

interface FeedState {
  feed: FeedScope;
  posts: Post[];
  loading: boolean;
  error: string;
  unauthorized: boolean;
}

function initialState(feed: FeedScope): FeedState {
  return { feed, posts: [], loading: true, error: "", unauthorized: false };
}

// useFeed loads the posts visible to the current user for a given feed
// scope (all/following/friends). Switching feed resets to a fresh loading
// state during render (rather than in an effect - see
// https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes),
// so a filter change never briefly shows the previous filter's results.
export function useFeed(feed: FeedScope) {
  const [state, setState] = useState<FeedState>(() => initialState(feed));
  const [attempt, setAttempt] = useState(0);

  if (state.feed !== feed) {
    setState(initialState(feed));
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await listPosts({ feed });
        if (!cancelled) {
          setState((s) => ({ ...s, posts: data, loading: false }));
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

  return {
    posts: state.posts,
    loading: state.loading,
    error: state.error,
    unauthorized: state.unauthorized,
    retry,
    removePost,
  };
}
