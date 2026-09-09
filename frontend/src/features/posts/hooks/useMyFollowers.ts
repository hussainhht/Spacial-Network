"use client";

import { useEffect, useState } from "react";
import { getFollowers, getMyProfile } from "@/features/profile/api/profiles";
import type { ProfileUserSummary } from "@/features/profile/types/profile";

// useMyFollowers loads the current user's own followers, so a post's
// custom-visibility audience can only ever be picked from among them.
export function useMyFollowers() {
  const [followers, setFollowers] = useState<ProfileUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const me = await getMyProfile();
        const list = await getFollowers(me.username);
        if (!cancelled) setFollowers(list);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load followers",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { followers, loading, error };
}
