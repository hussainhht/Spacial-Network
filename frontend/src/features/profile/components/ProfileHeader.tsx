"use client";

import Image from "next/image";
import { useState } from "react";
import { getBackendBaseUrl } from "@/lib/api";
import { getDisplayName, getInitials } from "@/lib/utils";
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

  const initials = getInitials(firstName, lastName, username);

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
            aria-label={getDisplayName(firstName, lastName, username)}
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
  followersCount: number;
  followingCount: number;
  onSelectPosts: () => void;
  onSelectFollows: () => void;
}

function ProfileStats({
  postsCount,
  followersCount,
  followingCount,
  onSelectPosts,
  onSelectFollows,
}: ProfileStatsProps) {
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

      <button
        type="button"
        className={styles.statItem}
        onClick={onSelectFollows}
        title="View Followers"
      >
        <span className={styles.statNumber}>{followersCount}</span>
        <span className={styles.statLabel}>
          {followersCount === 1 ? "Follower" : "Followers"}
        </span>
      </button>

      <button
        type="button"
        className={styles.statItem}
        onClick={onSelectFollows}
        title="View Following"
      >
        <span className={styles.statNumber}>{followingCount}</span>
        <span className={styles.statLabel}>Following</span>
      </button>
    </div>
  );
}

interface ProfileHeaderProps {
  profile: Profile;
  isOwnProfile: boolean;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  followLoading: boolean;
  onSelectTab: (tab: ProfileTab) => void;
  onToggleFollow: () => void;
}

export default function ProfileHeader({
  profile,
  isOwnProfile,
  postsCount,
  followersCount,
  followingCount,
  isFollowing,
  followLoading,
  onSelectTab,
  onToggleFollow,
}: ProfileHeaderProps) {
  const displayName = getDisplayName(
    profile.firstName,
    profile.lastName,
    profile.username,
  );

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

          {isOwnProfile ? (
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
          ) : profile.isPrivate ? (
            <div className={styles.actionsRow}>
              <span className={styles.statLabel}>
                Follow requests for private profiles will be added later.
              </span>
            </div>
          ) : (
            <div className={styles.actionsRow}>
              <button
                type="button"
                onClick={onToggleFollow}
                disabled={followLoading}
                className={isFollowing ? styles.btnSecondary : styles.btnPrimary}
                title={isFollowing ? "Unfollow" : "Follow"}
              >
                {followLoading ? "Saving..." : isFollowing ? "Unfollow" : "Follow"}
              </button>
            </div>
          )}
        </div>

        <div className={styles.identity}>
          <div className={styles.nameRow}>
            <h1 className={styles.fullName}>{displayName}</h1>
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
          followersCount={followersCount}
          followingCount={followingCount}
          onSelectPosts={() => onSelectTab("posts")}
          onSelectFollows={() => onSelectTab("about")}
        />
      </div>
    </header>
  );
}
