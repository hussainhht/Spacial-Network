import AppIcon from "@/components/layout/AppIcon";
import styles from "../group-chat.module.css";

export default function GroupChatEmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyStateIcon} aria-hidden="true">
        <AppIcon name="chat" width={28} height={28} />
      </div>
      <h3 className={styles.emptyStateTitle}>Start the conversation</h3>
      <p className={styles.emptyStateText}>
        This group is quiet for now. Send the first message to everyone here.
      </p>
    </div>
  );
}

