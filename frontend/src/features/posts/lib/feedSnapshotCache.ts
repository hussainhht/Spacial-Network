import type { FeedScope, Post } from "@/features/posts/types/post";

// In-memory only: a full reload (including demo identity switching, which
// reloads the page) naturally starts from a clean feed.
export interface FeedScrollPosition {
  anchorId: number | null;
  /** Anchor's top edge relative to the scroll pane's top edge, in px. */
  anchorOffset: number;
  /** Raw fallback if the anchor post is no longer available. */
  scrollTop: number;
}

export interface FeedSnapshot {
  posts: Post[];
  hasMore: boolean;
  scroll: FeedScrollPosition | null;
  savedAt: number;
}

const MAX_SNAPSHOTS = 6;
const MAX_POSTS = 300;
const MAX_AGE_MS = 30 * 60 * 1000;

// Insertion order doubles as LRU order.
const snapshots = new Map<string, FeedSnapshot>();
// Set by popstate (Back/Forward) and cleared once the destination route has
// committed, so it describes exactly one navigation with no timing involved.
let traversalPending = false;
// Set by in-app "return to feed" links, which push a new history entry but
// should still resume the feed. Cleared on the same schedule.
let resumeRequested = false;
let restorePendingAt = -Infinity;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    traversalPending = true;
  });
}

const keyOf = (ownerId: number, feed: FeedScope) => `${ownerId}:${feed}`;

/** Called from the "Back to home" style links before they navigate. */
export function requestFeedResume() {
  resumeRequested = true;
}

/** Called after a route commit; the navigation has been fully handled. */
export function endNavigationRestoreWindow() {
  traversalPending = false;
  resumeRequested = false;
}

/** Snapshot to restore for this visit, or null when the feed should load fresh. */
export function peekRestorableSnapshot(
  ownerId: number | null,
  feed: FeedScope,
): FeedSnapshot | null {
  if (ownerId == null || !(traversalPending || resumeRequested)) return null;
  const snapshot = snapshots.get(keyOf(ownerId, feed));
  if (!snapshot || Date.now() - snapshot.savedAt > MAX_AGE_MS) return null;
  return snapshot;
}

export function saveFeedPosts(
  ownerId: number | null,
  feed: FeedScope,
  posts: Post[],
  hasMore: boolean,
) {
  if (ownerId == null) return;
  const key = keyOf(ownerId, feed);
  if (posts.length === 0) {
    snapshots.delete(key);
    return;
  }
  // Never serve one account's feed to another.
  for (const existing of [...snapshots.keys()]) {
    if (!existing.startsWith(`${ownerId}:`)) snapshots.delete(existing);
  }
  const capped = posts.length > MAX_POSTS;
  const previous = snapshots.get(key);
  snapshots.delete(key);
  snapshots.set(key, {
    posts: capped ? posts.slice(0, MAX_POSTS) : posts,
    hasMore: capped ? true : hasMore,
    // A scroll position only describes the feed it was captured from.
    scroll:
      previous && previous.posts[0]?.id === posts[0]?.id ? previous.scroll : null,
    savedAt: Date.now(),
  });
  while (snapshots.size > MAX_SNAPSHOTS) {
    const oldest = snapshots.keys().next().value;
    if (oldest === undefined) break;
    snapshots.delete(oldest);
  }
}

export function saveFeedScroll(
  ownerId: number | null,
  feed: FeedScope,
  scroll: FeedScrollPosition,
) {
  if (ownerId == null) return;
  const snapshot = snapshots.get(keyOf(ownerId, feed));
  if (snapshot) snapshot.scroll = scroll;
}

export function forgetPostInFeedCache(postId: number) {
  for (const [key, snapshot] of snapshots) {
    if (snapshot.posts.some((post) => post.id === postId)) {
      snapshots.set(key, {
        ...snapshot,
        posts: snapshot.posts.filter((post) => post.id !== postId),
      });
    }
  }
}

export function clearFeedSnapshots() {
  snapshots.clear();
}

/** Lets AppShell skip its scroll-to-top reset while the feed restores. */
export function markFeedRestorePending() {
  restorePendingAt = Date.now();
}

export function consumeFeedRestorePending(): boolean {
  const pending = Date.now() - restorePendingAt < 1000;
  restorePendingAt = -Infinity;
  return pending;
}

export function getSavedFeedScroll(
  ownerId: number | null,
  feed: FeedScope,
): FeedScrollPosition | null {
  if (ownerId == null) return null;
  return snapshots.get(keyOf(ownerId, feed))?.scroll ?? null;
}
