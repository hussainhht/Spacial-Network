"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import AppIcon from "@/components/layout/AppIcon";
import GroupAvatar from "./GroupAvatar";
import GroupPrivacyBadge from "./GroupPrivacyBadge";
import type { Group } from "../types/group";

interface GroupHeaderCardProps {
  group: Group;
  memberCount: number;
  isCreator: boolean;
  membershipStatus: ReactNode;
  onEdit?: () => void;
}

export default function GroupHeaderCard({
  group,
  memberCount,
  isCreator,
  membershipStatus,
  onEdit,
}: GroupHeaderCardProps) {
  return (
    <header className="group-header-card">
      <GroupAvatar group={group} size={150} className="group-header-avatar" />
      <div className="group-header-info">
        <div className="group-header-info-top">
          <h1>{group.title}</h1>
          {isCreator && (
            <button
              type="button"
              onClick={onEdit}
              className="group-button secondary group-header-edit"
            >
              Edit Group
            </button>
          )}
        </div>
        <div className="group-header-meta-row">
          <GroupPrivacyBadge privacy={group.privacy} detailed />
          <span className="group-header-stat">
            <AppIcon name="groups" width={15} height={15} />
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </span>
          <span className="group-header-stat">
            Created by{" "}
            <Link
              href={`/profile/${encodeURIComponent(group.creatorUsername)}`}
              className="group-title-link"
            >
              @{group.creatorUsername}
            </Link>
          </span>
          {membershipStatus}
        </div>
        {group.description && (
          <p className="group-header-description">{group.description}</p>
        )}
      </div>
    </header>
  );
}
