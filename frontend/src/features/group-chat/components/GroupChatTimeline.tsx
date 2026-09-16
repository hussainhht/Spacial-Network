import type { RefObject } from "react";
import type { TimelineItem } from "../types/groupChat";
import GroupChatDayDivider from "./GroupChatDayDivider";
import GroupChatEmptyState from "./GroupChatEmptyState";
import GroupChatJumpToLatest from "./GroupChatJumpToLatest";
import GroupChatLoadingState from "./GroupChatLoadingState";
import GroupChatMessageGroup from "./GroupChatMessageGroup";
import styles from "../group-chat.module.css";

interface GroupChatTimelineProps {
  timelineRef: RefObject<HTMLDivElement | null>;
  items: TimelineItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  isAtBottom: boolean;
  unreadCount: number;
  onLoadMore: () => void;
  onJumpToLatest: () => void;
}

export default function GroupChatTimeline({
  timelineRef,
  items,
  loading,
  loadingMore,
  hasMore,
  isAtBottom,
  unreadCount,
  onLoadMore,
  onJumpToLatest,
}: GroupChatTimelineProps) {
  return (
    <div className={styles.timelineWrapper}>
      <div
        ref={timelineRef}
        className={styles.timeline}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={loading}
      >
        {hasMore && !loading && (
          <div className={styles.loadOlderWrapper}>
            <button
              type="button"
              className={styles.loadOlderButton}
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore
                ? "Loading older messages…"
                : "↑ Load older messages"}
            </button>
          </div>
        )}

        {loading && <GroupChatLoadingState />}

        {!loading && items.length === 0 && <GroupChatEmptyState />}

        {!loading &&
          items.map((item) => {
            if (item.type === "day-divider") {
              return <GroupChatDayDivider key={item.id} label={item.label} />;
            }
            return (
              <GroupChatMessageGroup key={item.id} cluster={item.cluster} />
            );
          })}
      </div>

      {!isAtBottom && !loading && (
        <GroupChatJumpToLatest
          unreadCount={unreadCount}
          onClick={onJumpToLatest}
        />
      )}
    </div>
  );
}
