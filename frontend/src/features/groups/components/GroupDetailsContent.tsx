"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { getGroup, getGroupMembers, getMembership } from "../api/groups";
import type { Group, GroupMember } from "../types/group";
import GroupInviteSearch from "./GroupInviteSearch";

export default function GroupDetailsContent() {
  const params = useParams<{ groupId: string }>();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creator, setCreator] = useState<GroupMember>();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    async function loadGroup() {
      try {
        const groupId = Number(params.groupId);

        if (Number.isNaN(groupId)) {
          throw new Error("Invalid group ID");
        }

        const result = await getGroup(groupId);
        const members = await getGroupMembers(groupId);
        const membership = await getMembership(groupId);

        setGroup(result);

        const groupCreator = members.find(
          (member) => member.userId === result.creatorId,
        );

        setCreator(groupCreator);
        setMembers(members);
        setIsMember(membership.isMember);

      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to load group",
        );
      } finally {
        setLoading(false);
      }
    }

    loadGroup();
  }, [params.groupId]);

  if (loading) {
    return <p>Loading group...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!group) {
    return <p>Group not found.</p>;
  }

  if (!creator) {
    return <p>Group creator not found.</p>;
  }

  return (
    <section>
      <h1>{group.title}</h1>

      <h2>Created by: {creator.username}</h2>
      <ol>
        {members.map((member) => (
          <li key={member.userId}>
            {member.username} - {member.role}
          </li>
        ))}
      </ol>

      <p>{group.description}</p>

      {isMember && <GroupInviteSearch groupId={group.id} />}
    </section>
  );
}
