"use client";

import styles from "./Profile.module.css";

interface ProfilePrivacyCardProps {
  isPrivate: boolean;
  onTogglePrivacy: () => Promise<void>;
  updating: boolean;
  error?: string | null;
}

export default function ProfilePrivacyCard({
  isPrivate,
  onTogglePrivacy,
  updating,
  error,
}: ProfilePrivacyCardProps) {
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
          ? "Your profile is private. Only approved followers can view your posts, activity, and protected profile details."
          : "Your profile is public. Anyone on Social Network can view your posts and follow your updates without manual approval."}
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
