import { parseDate } from "@/lib/utils";
import type {
  GroupChatMessage,
  GroupChatMessageCluster,
  TimelineItem,
} from "../types/groupChat";
import { formatDayDividerLabel, isSameCalendarDay } from "./groupChatDate";

const CLUSTER_TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function groupMessagesIntoTimeline(
  messages: GroupChatMessage[],
  currentUserId: number | null,
  creatorId?: number
): TimelineItem[] {
  const items: TimelineItem[] = [];
  let currentCluster: GroupChatMessageCluster | null = null;
  let lastMessageDateStr: string | null = null;
  let lastMessageTimeMs: number = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgDate = parseDate(msg.createdAt);
    const msgTimeMs = msgDate ? msgDate.getTime() : 0;
    const isNewDay = !lastMessageDateStr || !isSameCalendarDay(msg.createdAt, lastMessageDateStr);

    if (isNewDay) {
      if (currentCluster) {
        items.push({
          type: "cluster",
          id: currentCluster.clusterId,
          cluster: currentCluster,
        });
        currentCluster = null;
      }

      items.push({
        type: "day-divider",
        id: `day_${msg.createdAt.slice(0, 10)}_${i}`,
        label: formatDayDividerLabel(msg.createdAt),
        dateKey: msg.createdAt.slice(0, 10),
      });
    }

    const canJoinCurrentCluster =
      currentCluster !== null &&
      !isNewDay &&
      currentCluster.userId === msg.userId &&
      Math.abs(msgTimeMs - lastMessageTimeMs) <= CLUSTER_TIME_WINDOW_MS;

    if (canJoinCurrentCluster && currentCluster) {
      currentCluster.messages.push({
        id: msg.id,
        content: msg.content,
        createdAt: msg.createdAt,
      });
    } else {
      if (currentCluster) {
        items.push({
          type: "cluster",
          id: currentCluster.clusterId,
          cluster: currentCluster,
        });
      }

      currentCluster = {
        clusterId: `cluster_${msg.id}_${i}`,
        userId: msg.userId,
        username: msg.username,
        firstName: msg.firstName,
        lastName: msg.lastName,
        avatar: msg.avatar,
        isMine: currentUserId !== null && msg.userId === currentUserId,
        isCreator: creatorId !== undefined && msg.userId === creatorId,
        firstCreatedAt: msg.createdAt,
        messages: [
          {
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt,
          },
        ],
      };
    }

    lastMessageDateStr = msg.createdAt;
    lastMessageTimeMs = msgTimeMs;
  }

  if (currentCluster) {
    items.push({
      type: "cluster",
      id: currentCluster.clusterId,
      cluster: currentCluster,
    });
  }

  return items;
}

