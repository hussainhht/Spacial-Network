import AppIcon from "@/components/layout/AppIcon";
import GroupAvatar from "@/features/groups/components/GroupAvatar";
import type { Group } from "@/features/groups/types/group";
import type { GroupChatConnectionStatus } from "../types/groupChat";
import GroupChatConnectionState from "./GroupChatConnectionState";
import styles from "../group-chat.module.css";

interface GroupChatHeaderProps {
  group: Group;
  totalMembersCount: number;
  onlineCount: number;
  connectionStatus: GroupChatConnectionStatus;
  onOpenInfoSheet: () => void;
}

export default function GroupChatHeader({
  group,
  totalMembersCount,
  onlineCount,
  connectionStatus,
  onOpenInfoSheet,
}: GroupChatHeaderProps) {
  const memberLabel =
    totalMembersCount === 1 ? "1 member" : `${totalMembersCount} members`;

  return (
    <header className={styles.header}>
      <div className={styles.headerIdentity}>
        <div className={styles.headerEmblem}>
          <GroupAvatar group={group} size={40} />
        </div>
        <div className={styles.headerMeta}>
          <h2 className={styles.headerTitle}>{group.title}</h2>
          <div className={styles.headerSubtitle}>
            <span>Group chat</span>
            <span className={styles.headerSubtitleDot} aria-hidden="true" />
            <span>{memberLabel}</span>
            {onlineCount > 0 && (
              <>
                <span
                  className={styles.headerSubtitleDot}
                  aria-hidden="true"
                />
                <span style={{ color: "#34d399" }}>{onlineCount} online</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={styles.headerActions}>
        <GroupChatConnectionState status={connectionStatus} />

        <button
          type="button"
          className={styles.headerInfoButton}
          onClick={onOpenInfoSheet}
          aria-label="View group details and members"
        >
          <AppIcon name="groups" width={18} height={18} />
          <span>Members</span>
        </button>
      </div>
    </header>
  );
}

