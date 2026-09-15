"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/layout/AppIcon";
import { getBackendBaseUrl } from "@/lib/api";
import {
  createJoinRequest,
  getGroupRecommendations,
  type GroupRecommendation,
} from "@/features/groups/api/groups";
import styles from "./SuggestedGroups.module.css";

type JoinState = "idle" | "saving" | "joined" | "pending";

function imageUrl(path: string): string | null {
  if (!path) return null;
  return /^https?:\/\//i.test(path)
    ? path
    : getBackendBaseUrl() + (path.startsWith("/") ? path : "/" + path);
}

function context(group: GroupRecommendation): string | null {
  const first = group.mutualMemberPreview[0];
  if (!first || group.mutualMemberCount === 0) return null;
  if (group.mutualMemberCount === 1) return `@${first} is a member`;
  return `@${first} + ${group.mutualMemberCount - 1} ${group.mutualMemberCount === 2 ? "other" : "others"} are members`;
}

function Skeletons() {
  return <div className={styles.list} aria-hidden="true">
    {[0, 1, 2].map((item) => <div className={styles.skeleton} key={item}>
      <span className={styles.skeletonAvatar} />
      <span className={styles.skeletonCopy}><span /><span /></span>
      <span className={styles.skeletonButton} />
    </div>)}
  </div>;
}

export default function SuggestedGroups({ limit = 3 }: { limit?: 2 | 3 }) {
  const [groups, setGroups] = useState<GroupRecommendation[]>([]);
  const [states, setStates] = useState<Record<number, JoinState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGroups(await getGroupRecommendations(limit));
      setStates({});
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load group suggestions");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    const requestID = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(requestID);
  }, [load]);

  const join = async (group: GroupRecommendation) => {
    if (states[group.id] && states[group.id] !== "idle") return;
    const successState: JoinState = group.requiresApproval ? "pending" : "joined";
    setError(null);
    setStates((current) => ({ ...current, [group.id]: successState }));
    try {
      await createJoinRequest(group.id);
    } catch (requestError) {
      setStates((current) => ({ ...current, [group.id]: "idle" }));
      setError(requestError instanceof Error ? requestError.message : "Unable to join this group");
    }
  };

  return (
    <section className={styles.card} aria-labelledby="suggested-groups-title">
      <header className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true"><AppIcon name="groups" width={17} height={17} /></span>
        <h2 id="suggested-groups-title">Explore Groups</h2>
      </header>

      {loading ? <Skeletons /> : error && groups.length === 0 ? (
        <div className={styles.state} role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>
      ) : groups.length === 0 ? (
        <p className={styles.empty}>No new groups to suggest</p>
      ) : (
        <div className={styles.list}>
          {groups.map((group) => {
            const avatar = imageUrl(group.avatarUrl);
            const state = states[group.id] ?? "idle";
            const groupContext = context(group);
            const label = state === "pending" ? "Pending Request" : state === "joined" ? "Joined" : "Join";
            return <article className={styles.row} key={group.id}>
              <Link href={`/groups/${group.id}`} className={styles.avatar} aria-label={`View ${group.name}`}>
                {avatar ? (
                  // Group photos are user uploads served by the Go backend.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" />
                ) : <span aria-hidden="true">{group.name.slice(0, 2).toUpperCase()}</span>}
              </Link>
              <div className={styles.details}>
                <Link href={`/groups/${group.id}`} className={styles.name} title={group.name}>{group.name}</Link>
                {groupContext ? <span className={styles.context}>{groupContext}</span> : null}
              </div>
              <button
                type="button"
                className={state === "idle" ? styles.joinButton : styles.completeButton}
                onClick={() => void join(group)}
                disabled={state !== "idle"}
              >
                {label}
              </button>
            </article>;
          })}
        </div>
      )}
      {error && groups.length > 0 ? <p className={styles.error} role="alert">{error}</p> : null}
    </section>
  );
}
