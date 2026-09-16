import styles from "../group-chat.module.css";

interface GroupChatDayDividerProps {
  label: string;
}

export default function GroupChatDayDivider({ label }: GroupChatDayDividerProps) {
  return (
    <div className={styles.dayDivider} role="separator" aria-label={label}>
      <span className={styles.dayDividerLine} aria-hidden="true" />
      <span className={styles.dayDividerPill}>{label}</span>
    </div>
  );
}

