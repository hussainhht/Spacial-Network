import styles from "../group-chat.module.css";

export default function GroupChatLoadingState() {
  return (
    <div
      className={styles.timelineLoadingState}
      role="status"
      aria-label="Loading chat history…"
    >
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={styles.messageGroup} aria-hidden="true">
          <div
            className={`${styles.skeletonPulse}`}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              flexShrink: 0,
            }}
          />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              className={`${styles.skeletonPulse}`}
              style={{ width: "120px", height: "14px", borderRadius: "4px" }}
            />
            <div
              className={`${styles.skeletonPulse}`}
              style={{
                width: i % 2 === 0 ? "75%" : "50%",
                height: "16px",
                borderRadius: "4px",
              }}
            />
            {i % 2 === 0 && (
              <div
                className={`${styles.skeletonPulse}`}
                style={{ width: "35%", height: "16px", borderRadius: "4px" }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

