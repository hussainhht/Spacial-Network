import type { GroupChatConnectionStatus } from "../types/groupChat";
import styles from "../group-chat.module.css";

interface GroupChatConnectionStateProps {
  status: GroupChatConnectionStatus;
}

export default function GroupChatConnectionState({
  status,
}: GroupChatConnectionStateProps) {
  const label =
    status === "connected"
      ? "Connected"
      : status === "reconnecting"
      ? "Reconnecting…"
      : "Offline";

  const statusClass =
    status === "connected"
      ? styles.statusConnected
      : status === "reconnecting"
      ? styles.statusReconnecting
      : styles.statusOffline;

  return (
    <span
      className={`${styles.connectionBadge} ${statusClass}`}
      role="status"
      aria-label={`Chat status: ${label}`}
      title={label}
    >
      <span className={styles.connectionDot} aria-hidden="true" />
      <span className={styles.connectionText}>{label}</span>
    </span>
  );
}

