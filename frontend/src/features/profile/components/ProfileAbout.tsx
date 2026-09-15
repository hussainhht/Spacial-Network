"use client";

import AppIcon from "@/components/layout/AppIcon";
import { parseDate } from "@/lib/utils";
import type { Profile } from "../types/profile";
import styles from "./Profile.module.css";

const CONSTELLATION_STARS = [
  [6, 46],
  [32, 30],
  [56, 38],
  [86, 12],
  [114, 22],
] as const;

function Constellation() {
  return (
    <svg
      className={styles.constellation}
      viewBox="0 0 120 56"
      aria-hidden="true"
    >
      <polyline
        points={CONSTELLATION_STARS.map(([x, y]) => `${x},${y}`).join(" ")}
      />
      {CONSTELLATION_STARS.map(([cx, cy], index) => (
        <circle key={index} cx={cx} cy={cy} r={index === 3 ? 2.2 : 1.4} />
      ))}
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" />
    </svg>
  );
}

// Dates of birth are calendar dates (YYYY-MM-DD) parsed as UTC midnight, so
// they are formatted in UTC to avoid shifting a day in western time zones.
function formatDateOfBirth(value: string): string | null {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;
}

interface ProfileAboutProps {
  profile: Profile;
  isOwnProfile: boolean;
  onEditProfile?: () => void;
}

export default function ProfileAbout({
  profile,
  isOwnProfile,
  onEditProfile,
}: ProfileAboutProps) {
  const aboutMe = profile.aboutMe.trim();
  // The backend only includes the date of birth for the profile owner.
  const dateOfBirth = formatDateOfBirth(profile.dateOfBirth);

  return (
    <section className={styles.about} aria-labelledby="profile-about-heading">
      <div className={styles.aboutAside}>
        <h2 id="profile-about-heading" className={styles.sectionEyebrow}>
          About
        </h2>
        <Constellation />
      </div>

      <div className={styles.aboutBody}>
        {aboutMe ? (
          <p className={styles.aboutText}>{aboutMe}</p>
        ) : isOwnProfile ? (
          <div className={styles.aboutEmpty}>
            <p className={styles.aboutEmptyText}>
              Add a short introduction so people know who they&apos;re
              connecting with.
            </p>
            {onEditProfile && (
              <button
                type="button"
                className={styles.textButton}
                onClick={onEditProfile}
              >
                Write an introduction
                <AppIcon name="arrowRight" width={16} height={16} />
              </button>
            )}
          </div>
        ) : (
          <p className={styles.aboutEmptyText}>
            {profile.firstName || `@${profile.username}`} hasn&apos;t written an
            introduction yet.
          </p>
        )}

        {dateOfBirth && (
          <dl className={styles.details}>
            <div className={styles.detail}>
              <dt className={styles.detailLabel}>
                <MoonIcon />
                Born
              </dt>
              <dd className={styles.detailValue}>{dateOfBirth}</dd>
              {isOwnProfile && (
                <dd className={styles.detailNote}>Only visible to you</dd>
              )}
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}
