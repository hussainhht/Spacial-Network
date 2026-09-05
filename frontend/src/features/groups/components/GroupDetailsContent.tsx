"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { getGroup, getGroupMembers, getMembership } from "../api/groups";
import type { Group, GroupMember } from "../types/group";
import GroupInviteSearch from "./GroupInviteSearch";
import GroupJoinButton from "./GroupJoinButton";

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

  return (
    <div className="group-details-container">
      <Link href="/groups" className="back-link">
        &larr; Back to groups
      </Link>

      {loading && <p>Loading group...</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && !group && <p>Group not found.</p>}
      {!loading && !error && group && !creator && (
        <p>Group creator not found.</p>
      )}

      {!loading && !error && group && creator && (
        <article className="group-detail-card">
          <header className="group-detail-header">
            <h1>{group.title}</h1>
            <span className="group-detail-creator">
              Created by {creator.username}
            </span>
          </header>

          <p className="group-detail-description">{group.description}</p>

          <div className="group-members">
            <h2>Members</h2>

            <ul className="group-members-list">
              {members.map((member) => (
                <li key={member.userId} className="group-member-item">
                  <span className="group-member-name">{member.username}</span>
                  <span className="group-member-role">{member.role}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="group-action-panel">
            {isMember ? (
              <GroupInviteSearch groupId={group.id} />
            ) : (
              <GroupJoinButton groupId={group.id} />
            )}
          </div>
        </article>
      )}
    </div>
  );
}
