import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { getDisplayName } from "@/lib/utils";
import type { GroupMember } from "@/features/groups/types/group";
import styles from "../group-chat.module.css";

interface GroupChatMembersPreviewProps {
  members: GroupMember[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isUserOnline: (userId: number) => boolean;
  creatorId?: number;
  loading?: boolean;
}

export default function GroupChatMembersPreview({
  members,
  searchQuery,
  onSearchChange,
  isUserOnline,
  creatorId,
  loading = false,
}: GroupChatMembersPreviewProps) {
  return (
    <>
      <div className={styles.memberSearchInputWrap}>
        <input
          type="search"
          placeholder="Filter members…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.memberSearchInput}
          aria-label="Filter group members"
        />
      </div>

      <div className={styles.membersList}>
        {loading && (
          <p
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.8rem",
              color: "var(--space-text-muted)",
            }}
          >
            Loading members…
          </p>
        )}

        {!loading && members.length === 0 && (
          <p
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.8rem",
              color: "var(--space-text-muted)",
            }}
          >
            No members found.
          </p>
        )}

        {!loading &&
          members.map((member) => {
            const isOnline = isUserOnline(member.userId);
            const isCreator =
              member.userId === creatorId || member.role === "creator";

            const roleLabel = isCreator
              ? "Group creator"
              : isOnline
              ? "Online"
              : "Member";

            const displayName = getDisplayName(
              member.firstName,
              member.lastName,
              member.username
            );

            return (
              <Link
                key={member.userId}
                href={`/profile/${member.username}`}
                className={styles.memberRow}
              >
                <div className={styles.memberAvatarWrap}>
                  <UserAvatar
                    src={member.avatar}
                    firstName={member.firstName}
                    lastName={member.lastName}
                    username={member.username}
                    size={32}
                    alt=""
                  />
                  {isOnline && <span className={styles.memberOnlineDot} />}
                </div>

                <div className={styles.memberDetails}>
                  <span className={styles.memberUsername}>
                    {member.username}
                  </span>
                  <span className={styles.memberUsername}>{displayName}</span>
                  <span className={styles.memberRole}>{roleLabel}</span>
                </div>
              </Link>
            );
          })}
      </div>
    </>
  );
}

