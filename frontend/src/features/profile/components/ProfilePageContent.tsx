"use client";

import { useEffect, useState } from "react";
import { getProfileByUsername } from "../api/profiles";
import type { Profile } from "../types/profile";
import Image from "next/image";

interface ProfilePageContentProps {
  username: string;
}

export default function ProfilePageContent({
  username,
}: ProfilePageContentProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const result = await getProfileByUsername(username);
        setProfile(result);
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

  if (loading) {
    return <p>Loading profile...</p>;
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
        <h2>Followers</h2>
        <p>Followers list will appear here later.</p>
      </section>

      <section>
        <h2>Following</h2>
        <p>Following list will appear here later.</p>
      </section>

      <section>
        <h2>Posts</h2>
        <p>User posts will appear here later.</p>
      </section>
    </main>
  );
}
