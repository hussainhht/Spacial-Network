import styles from "../group-chat.module.css";

interface GroupChatErrorStateProps {
  error: string;
  onRetry?: () => void;
}

export default function GroupChatErrorState({
  error,
  onRetry,
}: GroupChatErrorStateProps) {
  return (
    <div className={styles.errorBanner} role="alert">
      <span>{error}</span>
      {onRetry && (
        <button
          type="button"
          className={styles.errorRetryBtn}
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}

