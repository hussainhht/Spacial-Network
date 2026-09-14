"use client";

import Link from "next/link";
import type { Group } from "../types/group";
import { GroupLoadError } from "./GroupPanels";
import AppIcon from "@/components/layout/AppIcon";
import GroupCard from "./GroupCard";
import styles from "./GroupsDirectory.module.css";

export type GroupQueryState = {
  data: Group[] | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export default function GroupList({
  state,
  search,
  mine,
  onBrowseAll,
  onClearSearch,
}: {
  state: GroupQueryState;
  search: string;
  mine: boolean;
  onBrowseAll: () => void;
  onClearSearch: () => void;
}) {
  const groups = state.data ?? [];

  return (
    <div aria-busy={state.loading}>
      {state.error && <GroupLoadError error={state.error} retry={state.refresh} />}
      {state.loading && groups.length === 0 && (
        <div className={styles.grid} aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div className={`${styles.card} ${styles.skeleton}`} key={index}>
              <span className={styles.skeletonCover} />
              <span /><span /><span />
            </div>
          ))}
        </div>
      )}
      {!state.loading && !state.error && groups.length === 0 && (
        <div className={styles.empty}>
          <AppIcon name={search ? "search" : "groups"} width={32} height={32} />
          <h2>{search ? "No groups found" : "No groups yet"}</h2>
          <p className="group-muted">
            {search
              ? "Try another name or clear your search."
              : mine
                ? "You haven’t joined any groups yet. Explore all groups or create one."
                : "Create a group to start a new community."}
          </p>
          {search ? (
            <button type="button" className="group-button secondary" onClick={onClearSearch}>Clear search</button>
          ) : (
            <div className="group-buttons">
              {mine && (
                <button type="button" className="group-button secondary" onClick={onBrowseAll}>
                  Browse Groups
                </button>
              )}
              <Link href="/groups/create" className="group-button">Create Group</Link>
            </div>
          )}
        </div>
      )}
      <ul className={styles.grid} aria-label="Groups">
        {groups.map((group) => (
          <li key={group.id}>
            <GroupCard group={group} />
          </li>
        ))}
      </ul>
    </div>
  );
}
