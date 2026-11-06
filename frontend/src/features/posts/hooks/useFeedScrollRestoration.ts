"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { FeedScope } from "@/features/posts/types/post";
import {
  getSavedFeedScroll,
  markFeedRestorePending,
  saveFeedScroll,
} from "@/features/posts/lib/feedSnapshotCache";

const SETTLE_MS = 8000;
const USER_INPUT_EVENTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

function postArticles(list: HTMLElement) {
  return Array.from(list.querySelectorAll<HTMLElement>('article[id^="post-"]'));
}

function articlePostId(el: HTMLElement) {
  const id = Number(el.id.slice("post-".length));
  return Number.isFinite(id) ? id : null;
}

/**
 * Remembers which post sits at the top of the scroll pane (plus the offset
 * within it) and, when the feed was rebuilt from the snapshot cache, scrolls
 * that post back to the same place before the first paint.
 */
export function useFeedScrollRestoration({
  feed,
  ownerId,
  listRef,
  ready,
  restored,
}: {
  feed: FeedScope;
  ownerId: number | null;
  listRef: RefObject<HTMLElement | null>;
  /** Posts for `feed` are rendered. */
  ready: boolean;
  /** Posts came from the snapshot cache. */
  restored: boolean;
}) {
  const latest = useRef({ feed, ownerId, ready });
  useEffect(() => {
    latest.current = { feed, ownerId, ready };
  });

  // Track position with a passive, rAF-throttled listener; no React state.
  useEffect(() => {
    const list = listRef.current;
    const pane = list?.closest<HTMLElement>("#page-content");
    if (!list || !pane || !ready) return;

    let frame = 0;
    function capture() {
      frame = 0;
      const current = latest.current;
      if (!current.ready || !list?.isConnected || !pane) return;
      const articles = postArticles(list);
      if (articles.length === 0) return;
      const paneTop = pane.getBoundingClientRect().top;
      // Binary search for the first card whose bottom edge is below the pane top.
      let lo = 0;
      let hi = articles.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (articles[mid].getBoundingClientRect().bottom > paneTop) hi = mid;
        else lo = mid + 1;
      }
      const anchor = articles[lo];
      saveFeedScroll(current.ownerId, current.feed, {
        anchorId: articlePostId(anchor),
        anchorOffset: anchor.getBoundingClientRect().top - paneTop,
        scrollTop: pane.scrollTop,
      });
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(capture);
    }

    pane.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      pane.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [listRef, ready, feed, ownerId]);

  // Restore before paint, then keep the anchor pinned while images/layout settle.
  useLayoutEffect(() => {
    const list = listRef.current;
    const pane = list?.closest<HTMLElement>("#page-content");
    if (!restored || !ready || !list || !pane) return;
    const saved = getSavedFeedScroll(ownerId, feed);
    if (!saved) return;

    markFeedRestorePending();

    function apply() {
      if (!pane) return;
      const anchor =
        saved!.anchorId != null
          ? document.getElementById(`post-${saved!.anchorId}`)
          : null;
      if (anchor && list?.contains(anchor)) {
        const delta =
          anchor.getBoundingClientRect().top -
          pane.getBoundingClientRect().top -
          saved!.anchorOffset;
        if (Math.abs(delta) >= 1) pane.scrollTop += delta;
      } else {
        // Anchor post was deleted/unavailable: fall back to raw coordinates.
        pane.scrollTop = saved!.scrollTop;
      }
    }

    apply();
    const frame = requestAnimationFrame(apply);
    const observer = new ResizeObserver(apply);
    observer.observe(list);

    function stop() {
      observer.disconnect();
      for (const name of USER_INPUT_EVENTS) pane?.removeEventListener(name, stop);
    }
    for (const name of USER_INPUT_EVENTS) {
      pane.addEventListener(name, stop, { passive: true });
    }
    const timer = window.setTimeout(stop, SETTLE_MS);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      stop();
    };
  }, [listRef, restored, ready, feed, ownerId]);
}
