import PostSharePreview from "@/features/interactions/components/PostSharePreview";
import { parseSharedPost } from "@/features/interactions/utils/sharedPost";
import type { GroupChatMessageItem } from "../types/groupChat";
import { formatMessageTime } from "../utils/groupChatDate";
import styles from "../group-chat.module.css";

interface GroupChatMessageContentProps {
  message: GroupChatMessageItem;
  isMine?: boolean;
  showHoverTime?: boolean;
}

export default function GroupChatMessageContent({
  message,
  isMine = false,
  showHoverTime = true,
}: GroupChatMessageContentProps) {
  const sharedPost = parseSharedPost(message.content);
  const formattedTime = formatMessageTime(message.createdAt);
  const bubbleClass = `${styles.messageBody} ${
    isMine ? styles.messageBodyMine : styles.messageBodyOther
  }`;

  if (sharedPost) {
    return (
      <div
        className={`${styles.messageItem} ${
          isMine ? styles.messageItemMine : ""
        }`}
      >
        <div className={bubbleClass}>
          {sharedPost.note && (
            <div dir="auto" style={{ marginBottom: "0.4rem" }}>
              {sharedPost.note}
            </div>
          )}
          <div className={styles.sharedPostWrap}>
            <PostSharePreview postId={sharedPost.postId} />
          </div>
        </div>
        {showHoverTime && formattedTime && (
          <time
            className={styles.messageItemTime}
            dateTime={message.createdAt}
            title={formattedTime}
          >
            {formattedTime}
          </time>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${styles.messageItem} ${
        isMine ? styles.messageItemMine : ""
      }`}
    >
      <div className={bubbleClass} dir="auto">
        {message.content}
      </div>
      {showHoverTime && formattedTime && (
        <time
          className={styles.messageItemTime}
          dateTime={message.createdAt}
          title={formattedTime}
        >
          {formattedTime}
        </time>
      )}
    </div>
  );
}

