"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import type { Notification } from "../types/notification";

export function useNotificationNavigate() {
  const router = useRouter();

  return useCallback(
    (notification: Notification) => {
      switch (notification.type) {
        case "group_join_request":
          if (notification.groupId) {
            router.push(`/groups/${notification.groupId}#join-requests`);
          } else {
            router.push("/groups");
          }
          break;

        case "group_invitation":
          if (notification.groupId) {
            router.push(`/groups/${notification.groupId}#invitations`);
          } else {
            router.push("/groups");
          }
          break;

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
