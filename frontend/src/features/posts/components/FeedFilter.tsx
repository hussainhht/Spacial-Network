"use client";

import type { FeedScope } from "@/features/posts/types/post";

const FEEDS: { value: FeedScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "following", label: "Following" },
  { value: "friends", label: "Friends" },
];

interface FeedFilterProps {
  active: FeedScope;
  onChange: (feed: FeedScope) => void;
}

export default function FeedFilter({ active, onChange }: FeedFilterProps) {
  return (
    <div className="feed-filter" role="tablist" aria-label="Feed filter">
      {FEEDS.map((feed) => (
        <button
          key={feed.value}
          type="button"
          role="tab"
          id={`feed-tab-${feed.value}`}
          aria-selected={active === feed.value}
          aria-controls="feed-tabpanel"
          data-active={active === feed.value}
          className="feed-filter-tab"
          onClick={() => onChange(feed.value)}
        >
          {feed.label}
        </button>
      ))}
    </div>
  );
}
