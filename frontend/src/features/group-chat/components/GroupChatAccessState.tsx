import styles from "../group-chat.module.css";

export default function GroupChatAccessState() {
  return (
    <div className={styles.restrictedState}>
      <span className={styles.restrictedIcon} aria-hidden="true">
        🔒
      </span>
      <h2 className={styles.restrictedTitle}>Group chat is member-only</h2>
      <p className={styles.restrictedDesc}>
        Join this group to view its conversation and message members.
      </p>
    </div>
  );
}

