"use client";

import AppIcon from "@/components/layout/AppIcon";
import styles from "./Profile.module.css";

export function ProfileLoadingState() {
  return (
    <div
      className={styles.container}
      role="status"
      aria-label="Loading profile..."
    >
      <div className={styles.identitySurface}>
        <div className={styles.hero}>
          <div className={`${styles.skeleton} ${styles.skeletonAvatar}`} />

          <div className={styles.identity}>
            <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
            <div className={`${styles.skeleton} ${styles.skeletonText}`} />
            <div className={styles.skeletonStats} aria-hidden="true">
              <div className={styles.skeleton} />
              <div className={styles.skeleton} />
              <div className={styles.skeleton} />
            </div>
            <div className={`${styles.skeleton} ${styles.skeletonButton}`} />
          </div>
        </div>

        <div className={styles.about}>
          <div className={styles.aboutAside}>
            <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
          </div>
          <div className={styles.aboutBody}>
            <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
            <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
            <div
              className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonLineShort}`}
            />
            <div className={styles.skeletonDetails} aria-hidden="true">
              <div className={styles.skeleton} />
              <div className={styles.skeleton} />
            </div>
          </div>
        </div>
      </div>

      <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
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
      <span className={styles.errorIconCircle} aria-hidden="true">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z M12 9v4 M12 17h.01" />
        </svg>
      </span>
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
      <span className={styles.lockedIconCircle} aria-hidden="true">
        <AppIcon name="lock" width={22} height={22} />
      </span>

      <h2 className={styles.lockedTitle}>This profile is private</h2>

      <p className={styles.lockedDescription}>
        Only approved followers can see this person&apos;s introduction, posts,
        and connections.
      </p>
    </section>
  );
}
