"use client";

import styles from "./Profile.module.css";

interface ProfilePrivacyProps {
  isPrivate: boolean;
  onTogglePrivacy: () => Promise<void>;
  updating: boolean;
  error?: string | null;
}

export default function ProfilePrivacy({
  isPrivate,
  onTogglePrivacy,
  updating,
  error,
}: ProfilePrivacyProps) {
  return (
    <section
      className={styles.privacyCard}
      aria-labelledby="privacy-settings-heading"
    >
      <div className={styles.privacyCardHeader}>
        <div>
          <h3 id="privacy-settings-heading" className={styles.cardTitle}>
            <span>Profile Visibility</span>
          </h3>
          <span className={styles.privacyStatusTag} data-private={isPrivate}>
            {isPrivate ? "🔒 Private Account" : "🌐 Public Account"}
          </span>
        </div>
      </div>

      <p className={styles.privacyCardDesc}>
        {isPrivate
          ? "Your profile is private. Protected details and posts are hidden from unauthorized visitors."
          : "Your profile is public. Anyone on Social Network can view your posts and profile information."}
      </p>

      <div className={styles.privacyActions}>
        <button
          type="button"
          onClick={onTogglePrivacy}
          disabled={updating}
          className={isPrivate ? styles.btnPrimary : styles.btnSecondary}
          aria-label={
            updating
              ? "Saving privacy settings"
              : isPrivate
                ? "Switch profile to public"
                : "Switch profile to private"
          }
        >
          {updating ? "Saving..." : isPrivate ? "Make Public" : "Make Private"}
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
