"use client";

export default function EmptyChat() {
  return (
    <div style={styles.container}>
      <div style={styles.iconCircle}>💬</div>
      <h2 style={styles.heading}>Your Messages</h2>
      <p style={styles.text}>
        Select a conversation from the sidebar to view chat history and start messaging in real time.
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    textAlign: "center",
    background: "rgba(8, 11, 26, 0.95)",
    color: "#94a3b8",
  },
  iconCircle: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    background: "rgba(99, 102, 241, 0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "2rem",
    marginBottom: "1rem",
  },
  heading: {
    margin: "0 0 0.5rem 0",
    color: "#f8fafc",
    fontSize: "1.25rem",
    fontWeight: 600,
  },
  text: {
    maxWidth: "340px",
    margin: 0,
    fontSize: "0.9rem",
    lineHeight: 1.5,
    color: "#64748b",
  },
};
