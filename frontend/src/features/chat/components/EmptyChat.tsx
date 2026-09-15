"use client";

import styles from "./Chat.module.css";

export default function EmptyChat() {
  return (
    <div className={`${styles.floatingCard} ${styles.emptyChat}`}>
      <div className={styles.emptyIconWrapper}>
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* Satellite and orbital transmission waves */}
          <path d="M13 7 9 3 5 7l4 4" />
          <path d="m17 11 4 4-4 4-4-4" />
          <path d="m8 12 4 4 6-6-4-4Z" />
          <path d="m16 8 3-3" />
          <path d="M9 21a6 6 0 0 0-6-6" />
          <path d="M14 21a11 11 0 0 0-11-11" />
        </svg>
      </div>
      <h2 className={styles.emptyTitle}>Orbital Transmission Relay</h2>
      <p className={styles.emptyDesc}>
        Select a conversation or choose New Chat to start a transmission. Your next connection is just a message away.
      </p>
    </div>
  );
}
