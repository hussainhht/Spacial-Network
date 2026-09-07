"use client";

import { useEffect, useState } from "react";
import {
  followUser,
  getFollowers,
  getFollowing,
  getFollowStatus,
  getMyProfile,
  getProfileByUsername,
  unfollowUser,
} from "../api/profiles";
import type { Profile, ProfileUserSummary } from "../types/profile";
import Image from "next/image";
import ProfileUserList from "./ProfileUserList";

interface ProfilePageContentProps {
  username: string;
}

export default function ProfilePageContent({
  username,
}: ProfilePageContentProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [followers, setFollowers] = useState<ProfileUserSummary[]>([]);
  const [following, setFollowing] = useState<ProfileUserSummary[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const [
          profileResult,
          currentUserResult,
          followersResult,
          followingResult,
          followStatusResult,
        ] = await Promise.all([
          getProfileByUsername(username),
          getMyProfile(),
          getFollowers(username),
          getFollowing(username),
          getFollowStatus(username),
        ]);

        setProfile(profileResult);
        setCurrentUser(currentUserResult);
        setFollowers(followersResult);
        setFollowing(followingResult);
        setIsFollowing(followStatusResult);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to load profile",
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [username]);

  async function reloadFollowData(profileUsername: string) {
    const [followersResult, followingResult, followStatusResult] =
      await Promise.all([
        getFollowers(profileUsername),
        getFollowing(profileUsername),
        getFollowStatus(profileUsername),
      ]);

    setFollowers(followersResult);
    setFollowing(followingResult);
    setIsFollowing(followStatusResult);
  }

  async function handleFollowToggle() {
    if (!profile) {
      return;
    }

    setFollowError(null);
    setFollowLoading(true);

    try {
      if (isFollowing) {
        await unfollowUser(profile.username);
      } else {
        await followUser(profile.username);
      }

      await reloadFollowData(profile.username);
    } catch (error) {
      setFollowError(
        error instanceof Error ? error.message : "Failed to update follow",
      );
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading) {
    return <p>Loading profile...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!profile) {
    return <p>Profile not found.</p>;
  }

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <main>
      <h1>
        {profile.firstName} {profile.lastName}
      </h1>

      <p>@{profile.username}</p>

      {profile.profilePhoto ? (
        <Image
          src={`http://localhost:8080${profile.profilePhoto}`}
          alt={`${profile.username}'s avatar`}
          width={120}
          height={120}
        />
      ) : (
        <p>No profile photo.</p>
      )}

      <section>
        <h2>Profile Info</h2>
        <p>Privacy: {profile.isPrivate ? "Private" : "Public"}</p>
        <p>Email: {profile.email}</p>
        <p>Age: {profile.age}</p>
        <p>Gender: {profile.gender}</p>
      </section>

      {!isOwnProfile && (
        <section>
          <h2>Follow</h2>
          {profile.isPrivate ? (
            <p>Follow requests for private profiles will be added later.</p>
          ) : (
            <button
              type="button"
              onClick={handleFollowToggle}
              disabled={followLoading}
            >
              {followLoading
                ? "Saving..."
                : isFollowing
                  ? "Unfollow"
                  : "Follow"}
            </button>
          )}
          {followError && <p>{followError}</p>}
        </section>
      )}

      <ProfileUserList
        title="Followers"
        users={followers}
        emptyMessage="No followers yet."
      />

      <ProfileUserList
        title="Following"
        users={following}
        emptyMessage="Not following anyone yet."
      />

      <section>
        <h2>Posts</h2>
        <p>User posts will appear here later.</p>
      </section>
    </main>
  );
}
