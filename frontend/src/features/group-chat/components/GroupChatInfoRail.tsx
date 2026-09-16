import GroupAvatar from "@/features/groups/components/GroupAvatar";
import type { Group, GroupMember } from "@/features/groups/types/group";
import GroupChatMembersPreview from "./GroupChatMembersPreview";
import styles from "../group-chat.module.css";

interface GroupChatInfoRailProps {
  group: Group;
  members: GroupMember[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isUserOnline: (userId: number) => boolean;
  onlineCount: number;
  totalMembersCount: number;
  loading?: boolean;
  onViewMembers: () => void;
}

export default function GroupChatInfoRail({
  group,
  members,
  searchQuery,
  onSearchChange,
  isUserOnline,
  onlineCount,
  totalMembersCount,
  loading = false,
  onViewMembers,
}: GroupChatInfoRailProps) {
  return (
    <aside className={styles.infoRail} aria-label="Group Information and Members">
      <div className={styles.infoRailSummary}>
        <div className={styles.infoRailEmblem}>
          <GroupAvatar group={group} size={52} />
        </div>
        <h3 className={styles.infoRailTitle}>{group.title}</h3>
        <span className={styles.infoRailPrivacyBadge}>
          {group.privacy} group
        </span>
        {group.description && (
          <p className={styles.infoRailDesc}>{group.description}</p>
        )}
      </div>

      <div className={styles.infoRailMembersHeader}>
        <h4 className={styles.infoRailMembersHeading}>
          <span>Members · {totalMembersCount}</span>
          {onlineCount > 0 && (
            <span className={styles.infoRailOnlineBadge}>
              {onlineCount} online
            </span>
          )}
        </h4>

        <button
          type="button"
          onClick={onViewMembers}
          className={styles.infoRailViewAllBtn}
        >
          View all
        </button>
      </div>

      <GroupChatMembersPreview
        members={members}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        isUserOnline={isUserOnline}
        creatorId={group.creatorId}
        loading={loading}
      />
    </aside>
  );
}

