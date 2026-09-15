"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/layout/AppIcon";
import { getBackendBaseUrl } from "@/lib/api";
import { followUser } from "@/features/profile/api/profiles";
import {
  getRecommendations,
  type Recommendation,
} from "../api/recommendations";
import styles from "./WhoToFollow.module.css";

function getAvatarUrl(path: string): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return getBackendBaseUrl() + (path.startsWith("/") ? path : "/" + path);
}

function initials(name: string, username: string): string {
  const letters = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (letters || username.slice(0, 2)).toUpperCase();
}

function mutualContext(recommendation: Recommendation): string {
  const [first, second] = recommendation.mutualPreview;
  if (!first || recommendation.mutualCount === 0) {
    return "Suggested for you";
  }
  if (recommendation.mutualCount === 1) {
    return "Followed by @" + first;
  }
  if (recommendation.mutualCount === 2 && second) {
    return "Followed by @" + first + " and @" + second;
  }
  return (
    "Followed by @" +
    first +
    " and " +
    String(recommendation.mutualCount - 1) +
    " others"
  );
}

function SuggestionRow({
  recommendation,
  onFollow,
  onDismiss,
}: {
  recommendation: Recommendation;
  onFollow: (recommendation: Recommendation) => void;
  onDismiss: (id: number) => void;
}) {
  const avatarUrl = getAvatarUrl(recommendation.avatarUrl);
  const following = recommendation.isFollowing;

  return (
    <article className={styles.row}>
      <Link
        href={"/profile/" + encodeURIComponent(recommendation.username)}
        className={styles.avatarLink}
        aria-label={"View @" + recommendation.username + "'s profile"}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.avatar} src={avatarUrl} alt="" />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true">
            {initials(recommendation.name, recommendation.username)}
          </span>
        )}
      </Link>

      <div className={styles.identity}>
        <Link
          href={"/profile/" + encodeURIComponent(recommendation.username)}
          className={styles.name}
        >
          {recommendation.name}
        </Link>
        <span className={styles.handle}>@{recommendation.username}</span>
        <span className={styles.context}>{mutualContext(recommendation)}</span>
      </div>

      <button
        type="button"
        className={following ? styles.followingButton : styles.followButton}
        onClick={() => onFollow(recommendation)}
        disabled={following}
        aria-pressed={following}
      >
        {following ? "Following" : "Follow"}
      </button>

      <button
        type="button"
        className={styles.dismissButton}
        onClick={() => onDismiss(recommendation.id)}
        aria-label={"Dismiss @" + recommendation.username}
        title="Dismiss suggestion"
      >
        <AppIcon name="x" width={14} height={14} />
      </button>
    </article>
  );
}

function SkeletonRows() {
  return (
    <div className={styles.skeletonRows} aria-hidden="true">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className={styles.skeletonRow}>
          <span className={styles.skeletonAvatar} />
          <span className={styles.skeletonCopy}>
            <span />
            <span />
          </span>
          <span className={styles.skeletonButton} />
        </div>
      ))}
    </div>
  );
}

export default function WhoToFollow({ limit = 3 }: { limit?: 3 | 4 }) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [dismissedIDs, setDismissedIDs] = useState<Set<number>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);

  const loadRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setFollowError(null);
    try {
      const nextRecommendations = await getRecommendations(limit);
      setRecommendations(nextRecommendations);
      setDismissedIDs(new Set());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load suggestions",
      );
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    const requestID = window.setTimeout(() => {
      void loadRecommendations();
    }, 0);
    return () => window.clearTimeout(requestID);
  }, [loadRecommendations]);

  const visibleRecommendations = useMemo(
    () =>
      recommendations
        .filter((recommendation) => !dismissedIDs.has(recommendation.id))
        .slice(0, limit),
    [dismissedIDs, limit, recommendations],
  );

  const handleDismiss = (id: number) => {
    setDismissedIDs((current) => new Set(current).add(id));
  };

  const handleFollow = async (recommendation: Recommendation) => {
    if (recommendation.isFollowing) return;

    setFollowError(null);
    setRecommendations((current) =>
      current.map((candidate) =>
        candidate.id === recommendation.id
          ? { ...candidate, isFollowing: true }
          : candidate,
      ),
    );

    try {
      await followUser(recommendation.username);
    } catch (requestError) {
      setRecommendations((current) =>
        current.map((candidate) =>
          candidate.id === recommendation.id
            ? { ...candidate, isFollowing: false }
            : candidate,
        ),
      );
      setFollowError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to follow this account",
      );
    }
  };

  return (
      <section className={styles.card} aria-labelledby="who-to-follow-title">
        <header className={styles.header}>
          <div>
            <h2 id="who-to-follow-title" className={styles.title}>
              Who to Follow
            </h2>
          </div>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void loadRecommendations()}
            disabled={isLoading}
            aria-label="Refresh follow suggestions"
            title="Refresh suggestions"
          >
            <AppIcon name="refresh" width={16} height={16} />
          </button>
        </header>

        {isLoading ? (
          <SkeletonRows />
        ) : error ? (
          <div className={styles.state} role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void loadRecommendations()}>
              Retry
            </button>
          </div>
        ) : visibleRecommendations.length === 0 ? (
          <div className={styles.state}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <AppIcon name="orbit" width={19} height={19} />
            </span>
            <p>No suggestions right now.</p>
          </div>
        ) : (
          <>
            <div className={styles.rows}>
              {visibleRecommendations.map((recommendation) => (
                <SuggestionRow
                  key={recommendation.id}
                  recommendation={recommendation}
                  onFollow={handleFollow}
                  onDismiss={handleDismiss}
                />
              ))}
            </div>
            {followError && (
              <p className={styles.followError} role="alert">
                {followError}
              </p>
            )}
          </>
        )}
      </section>
  );
}
