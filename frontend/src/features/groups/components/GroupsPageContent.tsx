"use client";

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

  if (loading) {
    return <p>Loading groups...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <section>
      <h1>Groups</h1>

      {groups.length === 0 ? (
        <p>No groups yet.</p>
      ) : (
        <div>
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
            />
          ))}
        </div>
      )}
    </section>
  );
}