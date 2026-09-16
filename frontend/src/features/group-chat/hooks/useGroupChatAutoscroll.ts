"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getScrollOffsetFromBottom,
  isNearBottom,
  restoreScrollOffsetFromBottom,
  scrollToBottom,
} from "../utils/groupChatScroll";

export function useGroupChatAutoscroll() {
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const isAtBottomRef = useRef(true);

  // Keep ref in sync for event listeners and callbacks
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const handleScroll = useCallback(() => {
    const el = timelineRef.current;
    if (!el) return;

    const near = isNearBottom(el);
    setIsAtBottom(near);
    if (near) {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [handleScroll]);

  const scrollToLatest = useCallback((smooth: boolean = true) => {
    const el = timelineRef.current;
    if (!el) return;
    scrollToBottom(el, smooth);
    setIsAtBottom(true);
    setUnreadCount(0);
  }, []);

  const notifyNewMessage = useCallback(
    (isMine: boolean) => {
      const el = timelineRef.current;
      if (!el) return;

      if (isMine || isAtBottomRef.current) {
        // Natural follow for current user or when already near bottom
        window.requestAnimationFrame(() => {
          scrollToBottom(el, true);
          setIsAtBottom(true);
          setUnreadCount(0);
          window.requestAnimationFrame(() => {
            scrollToBottom(el, true);
          });
        });
      } else {
        // User has scrolled up to read history; increment unread counter
        setUnreadCount((prev) => prev + 1);
      }
    },
    []
  );

  const captureScrollAnchor = useCallback((): number => {
    const el = timelineRef.current;
    if (!el) return 0;
    return getScrollOffsetFromBottom(el);
  }, []);

  const restoreScrollAnchor = useCallback((offset: number) => {
    const el = timelineRef.current;
    if (!el || offset <= 0) return;
    window.requestAnimationFrame(() => {
      restoreScrollOffsetFromBottom(el, offset);
      window.requestAnimationFrame(() => {
        restoreScrollOffsetFromBottom(el, offset);
      });
    });
  }, []);

  return {
    timelineRef,
    isAtBottom,
    unreadCount,
    scrollToLatest,
    notifyNewMessage,
    captureScrollAnchor,
    restoreScrollAnchor,
  };
}

