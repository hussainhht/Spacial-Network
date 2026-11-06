"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { savePost, unsavePost } from "@/features/posts/api/posts";
import type { Post } from "@/features/posts/types/post";

// Last server-confirmed saved state per post, shared by every PostCard on
// screen so the same post reads the same in the feed, a profile, a group, the
// detail page and the Saved Posts page. Values are only ever written from a
// server response (or from a fetched post), never optimistically.
const confirmed = new Map<number, boolean>();
// Posts whose confirmed state came from this session's own save/unsave
// response. That is newer than any list fetched or cached earlier (such as a
// restored feed snapshot), so a post's embedded flag must not override it.
const confirmedByAction = new Set<number>();
// Posts with a save/unsave request in flight - guards against double clicks
// and keeps two cards of the same post from sending the same request.
const pending = new Set<number>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  listeners.forEach((listener) => listener());
}

/** Adopts the saved flag embedded in a fetched post. */
function hydrate(id: number, saved: boolean | undefined) {
  if (
    saved === undefined ||
    pending.has(id) ||
    confirmedByAction.has(id) ||
    confirmed.get(id) === saved
  ) return;
  confirmed.set(id, saved);
  emit();
}

/**
 * Saves or removes a bookmark and resolves to the state the server confirmed,
 * or null if a request for this post is already in flight. Rejects on failure
 * and leaves the last confirmed state untouched.
 */
export async function setPostSaved(id: number, next: boolean): Promise<boolean | null> {
  if (pending.has(id)) return null;
  pending.add(id);
  emit();
  try {
    const status = await (next ? savePost(id) : unsavePost(id));
    confirmed.set(id, status.saved);
    confirmedByAction.add(id);
    return status.saved;
  } finally {
    pending.delete(id);
    emit();
  }
}

/** Forgets every cached state, e.g. when the signed-in identity changes. */
export function resetSavedPosts() {
  confirmed.clear();
  confirmedByAction.clear();
  pending.clear();
  emit();
}

export function useSavedPost(post: Pick<Post, "id" | "saved">) {
  const { id } = post;
  const known = useSyncExternalStore(
    subscribe,
    () => confirmed.get(id),
    () => undefined,
  );
  const busy = useSyncExternalStore(
    subscribe,
    () => pending.has(id),
    () => false,
  );

  useEffect(() => {
    hydrate(id, post.saved);
  }, [id, post.saved]);

  const saved = known ?? post.saved ?? false;
  const set = useCallback((next: boolean) => setPostSaved(id, next), [id]);
  return { saved, busy, set };
}
