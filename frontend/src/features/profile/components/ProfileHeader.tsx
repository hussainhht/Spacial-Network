"use client";

import Link from "next/link";
import AppIcon from "@/components/layout/AppIcon";
import UserAvatar from "@/components/UserAvatar";
import { getDisplayName } from "@/lib/utils";
import type { Profile } from "../types/profile";
import styles from "./Profile.module.css";

const AVATAR_SIZE = 96;

interface ProfileAvatarProps {
  firstName: string;
  lastName: string;
  username: string;
  profilePhoto?: string;
}

function ProfileAvatar({
  firstName,
  lastName,
  username,
  profilePhoto,
}: ProfileAvatarProps) {
  return (
    <div className={styles.avatarOrbit}>
      <span className={styles.avatarHalo} aria-hidden="true" />
      <span className={styles.orbitRing} aria-hidden="true">
        <span className={styles.orbitMoon} />
      </span>

      <div className={styles.avatar}>
        <UserAvatar
          src={profilePhoto}
          firstName={firstName}
          lastName={lastName}
          username={username}
          size={AVATAR_SIZE}
          alt={`${getDisplayName(firstName, lastName, username)}'s avatar`}
          className={styles.avatarImage}
          priority
        />
      </div>
    </div>
  );
}

interface ProfileHeaderProps {
  profile: Profile;
  isOwnProfile: boolean;
  isFollowing: boolean;
  hasPendingFollowRequest: boolean;
  canMessage?: boolean;
  followLoading: boolean;
  followError?: string | null;
  showStats?: boolean;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  onEditProfile: () => void;
  onToggleFollow: () => void;
  onViewConnections: () => void;
}

export default function ProfileHeader({
  profile,
  isOwnProfile,
  isFollowing,
  hasPendingFollowRequest,
  canMessage = false,
  followLoading,
  followError = null,
  showStats = true,
  postsCount,
  followersCount,
  followingCount,
  onEditProfile,
  onToggleFollow,
  onViewConnections,
}: ProfileHeaderProps) {
  const displayName = getDisplayName(
    profile.firstName,
    profile.lastName,
    profile.username,
  );
  const followActionLabel = followLoading
    ? "Saving..."
    : isFollowing
      ? "Unfollow"
      : profile.isPrivate && hasPendingFollowRequest
        ? "Requested"
        : profile.isPrivate
          ? "Request Follow"
          : "Follow";
  const followActionTitle =
    profile.isPrivate && hasPendingFollowRequest
      ? "Follow request pending"
      : followActionLabel;
  const followActionDisabled =
    followLoading || (!isFollowing && hasPendingFollowRequest);
  const followActionClassName =
    isFollowing || hasPendingFollowRequest
      ? styles.btnSecondary
      : styles.btnPrimary;

  return (
    <header className={styles.hero}>
      <ProfileAvatar
        firstName={profile.firstName}
        lastName={profile.lastName}
        username={profile.username}
        profilePhoto={profile.profilePhoto}
      />

      <div className={styles.identity}>
        <h1 className={styles.fullName}>{displayName}</h1>

        {profile.nickname && (
          <p className={styles.nickname}>
            <span className="sr-only">Nickname: </span>
            {profile.nickname}
          </p>
        )}

        <p className={styles.metaRow}>
          <span className={styles.username}>@{profile.username}</span>
          <span className={styles.metaDot} aria-hidden="true" />
          <span className={styles.metaItem}>
            <AppIcon
              name={profile.isPrivate ? "lock" : "globe"}
              width={14}
              height={14}
            />
            {profile.isPrivate ? "Private profile" : "Public profile"}
          </span>
        </p>

        {showStats && (
          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{postsCount}</span>
              <span className={styles.statLabel}>Posts</span>
            </div>
            <button
              type="button"
              className={`${styles.statItem} ${styles.statItemLink}`}
              onClick={onViewConnections}
            >
              <span className={styles.statValue}>{followingCount}</span>
              <span className={styles.statLabel}>Following</span>
            </button>
            <button
              type="button"
              className={`${styles.statItem} ${styles.statItemLink}`}
              onClick={onViewConnections}
            >
              <span className={styles.statValue}>{followersCount}</span>
              <span className={styles.statLabel}>Followers</span>
            </button>
          </div>
        )}

        <div className={styles.actionsRow}>
          {isOwnProfile ? (
            <button
              type="button"
              onClick={onEditProfile}
              className={styles.btnSecondary}
            >
              Edit profile
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onToggleFollow}
                disabled={followActionDisabled}
                className={followActionClassName}
                title={followActionTitle}
              >
                {followActionLabel}
              </button>

              {canMessage && (
                <Link
                  href={`/chat?partnerId=${profile.id}`}
                  className={styles.btnSecondary}
                  title={`Message @${profile.username}`}
                >
                  <AppIcon name="chat" width={16} height={16} />
                  Message
                </Link>
              )}
            </>
          )}
        </div>

        {followError && (
          <p className={`form-error ${styles.followError}`} role="alert">
            {followError}
          </p>
        )}
      </div>
    </header>
  );
}
