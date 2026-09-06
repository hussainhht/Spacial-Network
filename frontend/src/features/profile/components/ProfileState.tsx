"use client";

import styles from "./Profile.module.css";

export function ProfileLoadingState() {
  return (
    <div
      className={`${styles.container} ${styles.headerCard}`}
      role="status"
      aria-label="Loading profile..."
    >
      <div className={`${styles.skeleton} ${styles.skeletonCover}`} />

      <div className={styles.headerBody}>
        <div className={styles.avatarAndActions}>
          <div className={`${styles.skeleton} ${styles.skeletonAvatar}`} />
          <div className={styles.actionsRow}>
            <div className={`${styles.skeleton} ${styles.skeletonButton}`} />
          </div>
        </div>

        <div className={styles.identity}>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          <div
            className={`${styles.skeleton} ${styles.skeletonText}`}
            style={{ width: "100px", marginTop: "6px" }}
          />
        </div>

        <div className={styles.statsRow}>
          <div
            className={`${styles.skeleton} ${styles.skeletonStats}`}
            style={{ width: "90px" }}
          />
        </div>
      </div>

      <div style={{ padding: "0 2rem 2rem" }}>
        <div
          className={`${styles.skeleton} ${styles.skeletonTabs}`}
          style={{ marginBottom: "1.5rem" }}
        />
        <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
      </div>
    </div>
  );
}

interface ProfileErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ProfileErrorState({
  message = "Something went wrong while loading this profile.",
  onRetry,
}: ProfileErrorStateProps) {
  return (
    <div className={styles.errorCard} role="alert">
      <div
        className={styles.emptyIconCircle}
        style={{
          borderColor: "rgba(248, 113, 113, 0.3)",
          color: "var(--space-error-text)",
        }}
      >
        ⚠️
      </div>
      <h2 className={styles.errorTitle}>Unable to load profile</h2>
      <p className={styles.errorMessage}>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={styles.btnSecondary}>
          Try Again
        </button>
      )}
    </div>
  );
}

export function PrivateProfileState() {
  return (
    <section className={styles.lockedCard} aria-label="Private profile notice">
      <div className={styles.lockedIconCircle} aria-hidden="true">
        🔒
      </div>

      <h2 className={styles.lockedTitle}>This profile is private</h2>

      <p className={styles.lockedDescription}>
        This user has set their profile to private. Protected content is hidden.
      </p>
    </section>
  );
}
