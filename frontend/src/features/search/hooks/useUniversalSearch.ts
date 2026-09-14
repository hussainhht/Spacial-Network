"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchSearchResults } from "../api/search";
import type {
  EventResult,
  GroupResult,
  NavigationShortcut,
  PostResult,
  SearchCategory,
  SearchResults,
  UserResult,
} from "../types/search";

const RECENT_SEARCHES_KEY = "cosmic_recent_searches";
const MAX_RECENT_SEARCHES = 6;

export const DEFAULT_SHORTCUTS: NavigationShortcut[] = [
  {
    id: "nav-universe",
    title: "Explore Universe (Solar System)",
    description: "3D planetary navigation and orbital system",
    href: "/",
    icon: "orbit",
  },
  {
    id: "nav-posts",
    title: "Posts Stream",
    description: "Browse the latest public and community posts",
    href: "/posts",
    icon: "posts",
  },
  {
    id: "nav-new-post",
    title: "Create New Post",
    description: "Publish a cosmic thought, update, or photo",
    href: "/posts/new",
    icon: "plus",
  },
  {
    id: "nav-groups",
    title: "All Groups",
    description: "Discover, join, and collaborate in space groups",
    href: "/groups",
    icon: "groups",
  },
  {
    id: "nav-chat",
    title: "Messages & Chat",
    description: "Direct real-time conversations with mutuals",
    href: "/chat",
    icon: "chat",
  },
  {
    id: "nav-notifications",
    title: "Notifications",
    description: "View latest activity, invites, and follow alerts",
    href: "/notifications",
    icon: "bell",
  },
];

export interface NavigableItem {
  id: string;
  type: "shortcut" | "user" | "group" | "post" | "event";
  title: string;
  subtitle?: string;
  href: string;
  badge?: string;
  data: NavigationShortcut | UserResult | GroupResult | PostResult | EventResult;
}

export function useUniversalSearch(onClose?: () => void) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const [results, setResults] = useState<SearchResults>({
    query: "",
    users: [],
    groups: [],
    posts: [],
    events: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    try {
      setRecentSearches((prev) => {
        const filtered = prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
        const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {
    }
  };

  const clearRecentSearches = () => {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch {
    }
  };

  const removeRecentSearch = (term: string) => {
    try {
      setRecentSearches((prev) => {
        const updated = prev.filter((s) => s !== term);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {
    }
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({
        query: "",
        users: [],
        groups: [],
        posts: [],
        events: [],
      });
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = setTimeout(async () => {
      try {
        const data = await fetchSearchResults(trimmed, category, 10, controller.signal);
        setResults(data);
        setError(null);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load search results");
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, category]);

  const matchingShortcuts = useMemo(() => {
    if (category !== "all" && category !== "shortcuts") return [];
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return DEFAULT_SHORTCUTS;
    return DEFAULT_SHORTCUTS.filter(
      (s) =>
        s.title.toLowerCase().includes(trimmed) ||
        s.description.toLowerCase().includes(trimmed),
    );
  }, [query, category]);

  const navigableItems = useMemo<NavigableItem[]>(() => {
    const items: NavigableItem[] = [];

    matchingShortcuts.forEach((s) => {
      items.push({
        id: s.id,
        type: "shortcut",
        title: s.title,
        subtitle: s.description,
        href: s.href,
        data: s,
      });
    });

    if (category === "all" || category === "users") {
      results.users.forEach((u) => {
        items.push({
          id: `user-${u.id}`,
          type: "user",
          title: `${u.first_name} ${u.last_name}`.trim() || u.username,
          subtitle: `@${u.username}`,
          href: `/profile/${encodeURIComponent(u.username)}`,
          badge: u.is_following ? "Following" : u.is_private ? "Private" : undefined,
          data: u,
        });
      });
    }

    if (category === "all" || category === "groups") {
      results.groups.forEach((g) => {
        items.push({
          id: `group-${g.id}`,
          type: "group",
          title: g.title,
          subtitle: g.description,
          href: `/groups/${g.id}`,
          badge:
            g.membership_role === "creator"
              ? "Creator"
              : g.membership_role === "member"
                ? "Member"
                : `${g.member_count} member${g.member_count === 1 ? "" : "s"}`,
          data: g,
        });
      });
    }

    if (category === "all" || category === "posts") {
      results.posts.forEach((p) => {
        items.push({
          id: `post-${p.id}`,
          type: "post",
          title: p.title || p.content_snippet,
          subtitle: `by @${p.author_username}${p.group_title ? ` in ${p.group_title}` : ""}`,
          href: `/posts#post-${p.id}`,
          badge: p.group_title ? p.group_title : "Post",
          data: p,
        });
      });
    }

    if (category === "all" || category === "events") {
      results.events.forEach((e) => {
        items.push({
          id: `event-${e.id}`,
          type: "event",
          title: e.title,
          subtitle: e.group_title ? `Group: ${e.group_title}` : e.description,
          href: `/groups/${e.group_id}`,
          badge: "Event",
          data: e,
        });
      });
    }

    return items;
  }, [matchingShortcuts, results, category]);

  useEffect(() => {
    setActiveIndex(0);
  }, [navigableItems.length, category]);

  const selectItem = (item: NavigableItem) => {
    if (query.trim()) {
      saveRecentSearch(query.trim());
    }
    if (onClose) {
      onClose();
    }
    router.push(item.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (navigableItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % navigableItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + navigableItems.length) % navigableItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = navigableItems[activeIndex];
      if (current) {
        selectItem(current);
      }
    }
  };

  return {
    query,
    setQuery,
    category,
    setCategory,
    results,
    isLoading,
    error,
    recentSearches,
    saveRecentSearch,
    clearRecentSearches,
    removeRecentSearch,
    matchingShortcuts,
    navigableItems,
    activeIndex,
    setActiveIndex,
    selectItem,
    handleKeyDown,
  };
}

