import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { getDisplayName } from "@/lib/utils";
import type { GroupChatMessageCluster } from "../types/groupChat";
import { formatMessageTime } from "../utils/groupChatDate";
import GroupChatMessageContent from "./GroupChatMessageContent";
import styles from "../group-chat.module.css";

interface GroupChatMessageGroupProps {
  cluster: GroupChatMessageCluster;
}

export default function GroupChatMessageGroup({
  cluster,
}: GroupChatMessageGroupProps) {
  const displayName = cluster.username
    ? getDisplayName(cluster.firstName, cluster.lastName, cluster.username)
    : "Member";

  const profileHref = cluster.username ? `/profile/${cluster.username}` : null;
  const timeFormatted = formatMessageTime(cluster.firstCreatedAt);

  return (
    <div
      className={`${styles.messageGroup} ${
        cluster.isMine ? styles.messageGroupMine : ""
      }`}
    >
      {!cluster.isMine && (
        <div className={styles.senderAvatarColumn}>
          {profileHref ? (
            <Link
              href={profileHref}
              className={styles.senderAvatarLink}
              aria-label={`View ${displayName}'s profile`}
            >
              <UserAvatar
                src={cluster.avatar}
                firstName={cluster.firstName}
                lastName={cluster.lastName}
                username={cluster.username}
                size={36}
                alt=""
              />
            </Link>
          ) : (
            <UserAvatar
              src={cluster.avatar}
              firstName={cluster.firstName}
              lastName={cluster.lastName}
              username={cluster.username}
              size={36}
              alt=""
            />
          )}
        </div>
      )}

      <div className={styles.messageClusterContent}>
        {cluster.isMine ? (
          timeFormatted && (
            <div className={styles.senderHeader}>
              <time
                className={styles.clusterTimestamp}
                dateTime={cluster.firstCreatedAt}
              >
                {timeFormatted}
              </time>
            </div>
          )
        ) : (
          <div className={styles.senderHeader}>
            {profileHref ? (
              <Link href={profileHref} className={styles.senderNameLink}>
                {displayName}
              </Link>
            ) : (
              <span className={styles.senderNameLink}>{displayName}</span>
            )}

            {cluster.isCreator && (
              <span className={styles.badgeCreator}>Creator</span>
            )}

            {timeFormatted && (
              <time
                className={styles.clusterTimestamp}
                dateTime={cluster.firstCreatedAt}
              >
                {timeFormatted}
              </time>
            )}
          </div>
        )}

        <div className={styles.messagesStack}>
          {cluster.messages.map((item, index) => (
            <GroupChatMessageContent
              key={item.id}
              message={item}
              isMine={cluster.isMine}
              showHoverTime={index > 0 || cluster.messages.length > 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

