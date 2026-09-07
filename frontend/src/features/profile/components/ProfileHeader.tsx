"use client";

import Image from "next/image";
import { useState } from "react";
import { getBackendBaseUrl } from "@/lib/api";
import type { Profile, ProfileTab } from "../types/profile";
import styles from "./Profile.module.css";

function ProfileCover() {
  return (
    <div className={styles.coverBanner} aria-hidden="true">
      <div className={styles.coverArt} />
      <div className={styles.coverAccentLine} />
    </div>
  );
}

interface ProfileAvatarProps {
  firstName: string;
  lastName: string;
  username: string;
  profilePhoto?: string;
  isPrivate: boolean;
}

function ProfileAvatar({
  firstName,
  lastName,
  username,
  profilePhoto,
  isPrivate,
}: ProfileAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const initials =
    `${firstName ? firstName[0] : ""}${lastName ? lastName[0] : ""}`
      .trim()
      .toUpperCase() || username.slice(0, 2).toUpperCase();

  const getFullPhotoUrl = (path: string) => {
    if (/^https?:\/\//i.test(path)) return path;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${getBackendBaseUrl()}${cleanPath}`;
  };

  const hasPhoto = Boolean(profilePhoto) && !imageError;
  const photoUrl = profilePhoto ? getFullPhotoUrl(profilePhoto) : "";

  return (
    <div className={styles.avatarWrapper}>
      <div className={styles.avatar}>
        {hasPhoto ? (
          <Image
            src={photoUrl}
            alt={`${username}'s avatar`}
            width={124}
            height={124}
            className={styles.avatarImage}
            onError={() => setImageError(true)}
            priority
          />
        ) : (
          <div
            className={styles.avatarFallback}
            aria-label={`${firstName} ${lastName}`}
          >
            {initials}
          </div>
        )}
      </div>

      <span
        className={styles.privacyBadgeIcon}
        title={isPrivate ? "Private profile" : "Public profile"}
        aria-label={isPrivate ? "Private profile" : "Public profile"}
      >
        {isPrivate ? "🔒" : "🌐"}
      </span>
    </div>
  );
}

interface ProfileStatsProps {
  postsCount: number;
  onSelectPosts: () => void;
}

function ProfileStats({ postsCount, onSelectPosts }: ProfileStatsProps) {
  return (
    <div
      className={styles.statsRow}
      role="region"
      aria-label="Profile statistics"
    >
      <button
        type="button"
        className={styles.statItem}
        onClick={onSelectPosts}
        title="View Posts"
      >
        <span className={styles.statNumber}>{postsCount}</span>
        <span className={styles.statLabel}>
          {postsCount === 1 ? "Post" : "Posts"}
        </span>
      </button>
    </div>
  );
}

interface ProfileHeaderProps {
  profile: Profile;
  isOwnProfile: boolean;
  postsCount: number;
  onSelectTab: (tab: ProfileTab) => void;
}

export default function ProfileHeader({
  profile,
  isOwnProfile,
  postsCount,
  onSelectTab,
}: ProfileHeaderProps) {
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();

  return (
    <header className={styles.headerCard}>
      <ProfileCover />

      <div className={styles.headerBody}>
        <div className={styles.avatarAndActions}>
          <ProfileAvatar
            firstName={profile.firstName}
            lastName={profile.lastName}
            username={profile.username}
            profilePhoto={profile.profilePhoto}
            isPrivate={profile.isPrivate}
          />

          {isOwnProfile && (
            <div className={styles.actionsRow}>
              <button
                type="button"
                onClick={() => onSelectTab("about")}
                className={styles.btnSecondary}
                title="Privacy Settings"
              >
                Privacy Settings
              </button>
            </div>
          )}
        </div>

        <div className={styles.identity}>
          <div className={styles.nameRow}>
            <h1 className={styles.fullName}>{fullName || profile.username}</h1>
            <span
              className={styles.privacyPill}
              data-private={profile.isPrivate}
            >
              {profile.isPrivate ? "🔒 Private Profile" : "🌐 Public Profile"}
            </span>
          </div>

          <p className={styles.username}>@{profile.username}</p>
        </div>

        <ProfileStats
          postsCount={postsCount}
          onSelectPosts={() => onSelectTab("posts")}
        />
      </div>
    </header>
  );
}
