"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  getFollowers,
  getFollowing,
  getMyProfile,
  updateMyProfilePrivacy,
} from "../api/profiles";
import type { Profile, ProfileUserSummary } from "../types/profile";
import ProfileUserList from "./ProfileUserList";

export default function MyProfilePageContent() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [followers, setFollowers] = useState<ProfileUserSummary[]>([]);
  const [following, setFollowing] = useState<ProfileUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [privacyUpdating, setPrivacyUpdating] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const result = await getMyProfile();
        const [followersResult, followingResult] = await Promise.all([
          getFollowers(result.username),
          getFollowing(result.username),
        ]);

        setProfile(result);
        setFollowers(followersResult);
        setFollowing(followingResult);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load your profile",
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  async function handlePrivacyToggle() {
    if (!profile) {
      return;
    }

    const nextPrivacy = !profile.isPrivate;
    setPrivacyError(null);
    setPrivacyUpdating(true);

    try {
      const updatedPrivacy = await updateMyProfilePrivacy(nextPrivacy);
      setProfile({
        ...profile,
        isPrivate: updatedPrivacy,
      });
    } catch (error) {
      setPrivacyError(
        error instanceof Error
          ? error.message
          : "Failed to update profile privacy",
      );
    } finally {
      setPrivacyUpdating(false);
    }
  }

  if (loading) {
    return <p>Loading your profile...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!profile) {
    return <p>Profile not found.</p>;
  }

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

      <section>
        <h2>Privacy Settings</h2>
        <p>{profile.isPrivate ? "Private profile" : "Public profile"}</p>
        <button
          type="button"
          onClick={handlePrivacyToggle}
          disabled={privacyUpdating}
        >
          {privacyUpdating
            ? "Saving..."
            : profile.isPrivate
              ? "Make Public"
              : "Make Private"}
        </button>
        {privacyError && <p>{privacyError}</p>}
      </section>

      <ProfileUserList
        title="Followers"
        users={followers}
        emptyMessage="No followers yet."
      />

      <ProfileUserList
        title="Following"
        users={following}
        emptyMessage="You are not following anyone yet."
      />

      <section>
        <h2>Posts</h2>
        <p>Your posts will appear here later.</p>
      </section>
    </main>
  );
}
