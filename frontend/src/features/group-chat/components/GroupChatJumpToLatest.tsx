import styles from "../group-chat.module.css";

interface GroupChatJumpToLatestProps {
  unreadCount: number;
  onClick: () => void;
}

export default function GroupChatJumpToLatest({
  unreadCount,
  onClick,
}: GroupChatJumpToLatestProps) {
  const accessibleLabel =
    unreadCount > 0
      ? `Jump to latest, ${unreadCount} new ${
          unreadCount === 1 ? "message" : "messages"
        }`
      : "Jump to latest messages";

  return (
    <div className={styles.jumpToLatestWrap}>
      <button
        type="button"
        className={styles.jumpToLatestButton}
        onClick={onClick}
        aria-label={accessibleLabel}
      >
        <span aria-hidden="true">↓</span>
        {unreadCount > 0 ? (
          <>
            <span>New messages</span>
            <span className={styles.jumpBadge}>{unreadCount}</span>
          </>
        ) : (
          <span>Jump to latest</span>
        )}
      </button>
    </div>
  );
}

