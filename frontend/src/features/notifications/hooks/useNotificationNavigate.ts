"use client";

import { useRouter } from "next/navigation";
import { getPendingInvitations } from "@/features/groups/api/groups";
import type { Notification } from "../types/notification";

// Resolves where a notification click should go, using only existing
// frontend routes/components. Neither an invitation accept/decline UI nor a
// join-request management UI exists in the frontend yet, so both types land
// on the closest existing group page.
export function useNotificationNavigate() {
  const router = useRouter();

  return async function navigateToNotification(notification: Notification): Promise<void> {
    if (notification.type === "group_invitation" && notification.entityId != null) {
      try {
        const invitations = await getPendingInvitations();
        const match = invitations.find((inv) => inv.id === notification.entityId);
        if (match) {
          router.push(`/groups/${match.groupId}`);
          return;
        }
      } catch {
        // Fall through to the generic groups page below.
      }
      router.push("/groups");
      return;
    }

    // group_join_request: the notification only carries the join-request
    // ID, and the only backend route that can look up a join request
    // (GET /groups/{id}/join-requests) requires already knowing the group
    // ID. There is no existing endpoint to resolve request ID -> group ID,
    // so the groups listing is the closest existing page available.
    router.push("/groups");
  };
}
