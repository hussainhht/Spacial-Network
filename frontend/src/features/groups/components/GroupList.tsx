"use client";

import Link from "next/link";
import { useState } from "react";
import type { Group } from "../types/group";
import GroupAvatar from "./GroupAvatar";
import { GroupLoadError, MembershipBadge } from "./GroupPanels";
import GroupPreviewPanel from "./GroupPreviewPanel";

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
}: {
  state: GroupQueryState;
  search: string;
  mine: boolean;
  onBrowseAll: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const groups = state.data ?? [];
  const selected = groups.find((group) => group.id === selectedId);

  function closePreview() {
    document.getElementById(`group-preview-button-${selectedId}`)?.focus();
    setSelectedId(null);
  }

  return (
    <div
      aria-busy={state.loading}
      onKeyDown={(event) => {
        if (event.key === "Escape" && selected) {
          event.preventDefault();
          closePreview();
        }
      }}
    >
      {state.error && <GroupLoadError error={state.error} retry={state.refresh} />}
      {state.loading && <p role="status">Loading communities…</p>}
      {!state.loading && !state.error && groups.length === 0 && (
        <div className="group-panel">
          <h2>{search ? "No groups found" : "Find your community"}</h2>
          <p className="group-muted">
            {search
              ? "No groups match this search. Try another name."
              : mine
                ? "You haven’t joined any groups yet. Explore all groups or create one."
                : "Create a group to start a new community."}
          </p>
          {!search && (
            <div className="group-buttons">
              {mine && (
                <button type="button" className="group-button secondary" onClick={onBrowseAll}>
                  Explore all groups
                </button>
              )}
              <Link href="/groups/create" className="group-button">Create a group</Link>
            </div>
          )}
        </div>
      )}
      <ul className="groups-list" aria-label="Groups">
        {groups.map((group) => (
          <li key={group.id} className="group-card">
            <div className="group-card-top">
              <GroupAvatar group={group} size={56} />
              <MembershipBadge
                role={group.membershipRole}
                invited={group.hasPendingInvitation}
                pending={group.hasPendingJoinRequest}
              />
            </div>
            <h2><Link href={`/groups/${group.id}`}>{group.title}</Link></h2>
            <p className="group-card-creator">Created by @{group.creatorUsername}</p>
            <p className="group-card-description">{group.description}</p>
            <div className="group-card-footer">
              <span>{group.memberCount} {group.memberCount === 1 ? "member" : "members"}</span>
              <button
                id={`group-preview-button-${group.id}`}
                type="button"
                className="group-button secondary"
                aria-label={`Open preview for ${group.title}`}
                aria-expanded={selected?.id === group.id}
                aria-controls={selected?.id === group.id ? "group-preview" : undefined}
                onClick={() => setSelectedId(group.id)}
              >
                Preview
              </button>
            </div>
          </li>
        ))}
      </ul>
      {selected && <GroupPreviewPanel group={selected} onClose={closePreview} />}
    </div>
  );
}
