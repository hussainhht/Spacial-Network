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

        //todo add more notification types here in the future, such as post_comment, post_like, etc.
        /*
         * TODO: Add post notification navigation.
         *
         * Example future notification types:
         * - post_comment
         * - post_like
         *
         * Expected navigation:
         * /posts/{postId}
         *
         * This should be implemented only after post notifications
         * and postId are supported by the backend notification system.
         */

        default:
          router.push("/");
      }
    },
    [router],
  );
}
