"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import {
  getFollowNotificationData,
  getGroupNotificationData,
  type Notification,
} from "../types/notification";

export function useNotificationNavigate() {
  const router = useRouter();

  return useCallback(
    (notification: Notification) => {
      switch (notification.type) {
        case "group_join_request": {
          const groupData = getGroupNotificationData(notification);
          if (groupData) {
            router.push(`/groups/${groupData.group_id}#join-requests`);
          } else {
            router.push("/groups");
          }
          break;
        }

        case "group_invitation": {
          const groupData = getGroupNotificationData(notification);
          if (groupData) {
            router.push(`/groups/${groupData.group_id}#invitations`);
          } else {
            router.push("/groups");
          }
          break;
        }

        case "group_invitation_accepted":
        case "group_invitation_declined":
        case "group_join_accepted":
        case "group_join_rejected":
        case "group_event":
        case "event_rsvp": {
          const groupData = getGroupNotificationData(notification);
          if (groupData) {
            router.push(`/groups/${groupData.group_id}`);
          } else {
            router.push("/groups");
          }
          break;
        }

        case "group_message": {
          const groupData = getGroupNotificationData(notification);
          if (groupData) {
            router.push(`/groups/${groupData.group_id}#chat`);
          } else {
            router.push("/groups");
          }
          break;
        }

        case "private_message":
          if (notification.actorId) {
            router.push(`/chat?partnerId=${notification.actorId}`);
          } else {
            router.push("/chat");
          }
          break;

        case "follow_request":
          router.push("/profile");
          break;

        case "new_follower":
        case "follow_accepted": {
          const followData = getFollowNotificationData(notification);
          if (followData) {
            router.push(
              `/profile/${encodeURIComponent(followData.actor_username)}`,
            );
          } else {
            router.push("/profile");
          }
          break;
        }

        case "post_like":
        case "post_comment":
          if (notification.entityId) {
            router.push(`/posts/${notification.entityId}`);
          } else {
            router.push("/");
          }
          break;

        default:
          router.push("/");
      }
    },
    [router],
  );
}
