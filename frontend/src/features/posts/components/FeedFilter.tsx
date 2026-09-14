"use client";

import SegmentedTabs from "@/components/SegmentedTabs";
import type { FeedScope } from "@/features/posts/types/post";

const FEEDS = [
  { value: "all", label: "All" },
  { value: "following", label: "Following" },
  { value: "friends", label: "Friends" },
] satisfies ReadonlyArray<{ value: FeedScope; label: string }>;

interface FeedFilterProps {
  active: FeedScope;
  onChange: (feed: FeedScope) => void;
}

export default function FeedFilter({ active, onChange }: FeedFilterProps) {
  return (
    <SegmentedTabs
      value={active}
      options={FEEDS}
      onChange={onChange}
      ariaLabel="Feed filter"
      idPrefix="feed"
      panelId="feed-tabpanel"
    />
  );
}
