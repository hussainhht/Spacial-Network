"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGroups } from "../api/groups";
import type { Group } from "../types/group";
import GroupCard from "./GroupCard";

export default function GroupsPageContent() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGroups() {
      try {
        const result = await getGroups();

        setGroups(result);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load groups"
        );
      } finally {
        setLoading(false);
      }
    }

    loadGroups();
  }, []);

  return (
    <main className="groups-page space-shell">
      <div className="groups-container">
        <header className="groups-page-header">
          <h1>Groups</h1>
          <Link href="/groups/create" className="new-group-link">
            Create Group
          </Link>
        </header>

        {loading && <p>Loading groups...</p>}
        {error && <p className="form-error">{error}</p>}

        {!loading && !error && groups.length === 0 && (
          <p>No groups yet.</p>
        )}

        {!loading && !error && groups.length > 0 && (
          <div className="groups-list">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
