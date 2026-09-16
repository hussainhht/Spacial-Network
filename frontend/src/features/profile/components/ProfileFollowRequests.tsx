"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import UserAvatar from "@/components/UserAvatar";
import { useWebSocket } from "@/providers/WebSocketProvider";
import { getDisplayName } from "@/lib/utils";
import {
  acceptFollowRequest,
  declineFollowRequest,
  getPendingFollowRequests,
} from "../api/profiles";
import type { FollowRequest } from "../types/profile";
import styles from "./Profile.module.css";

interface ProfileFollowRequestsProps {
  onChanged?: () => void | Promise<void>;
}

type FollowRequestAction = "accept" | "decline";

export default function ProfileFollowRequests({
  onChanged,
}: ProfileFollowRequestsProps) {
  const { subscribeNotifications } = useWebSocket();
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    requestID: number;
    action: FollowRequestAction;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRequests() {
      try {
        const pendingRequests = await getPendingFollowRequests();
        if (isMounted) {
          setRequests(pendingRequests);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load follow requests",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadRequests();

    return () => {
      isMounted = false;
    };
  }, []);

  // The backend pushes a "follow_request" notification over the existing
  // WebSocket connection as soon as someone requests to follow this user,
  // so pick that up here instead of waiting for a page refresh.
  useEffect(() => {
    return subscribeNotifications((notification) => {
      if (notification.type !== "follow_request") {
        return;
      }

      getPendingFollowRequests()
        .then((pendingRequests) => {
          setRequests(pendingRequests);
          setError(null);
        })
        .catch((err) => {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load follow requests",
          );
        });
    });
  }, [subscribeNotifications]);

  async function handleRequestAction(
    requestID: number,
    action: FollowRequestAction,
  ) {
    setPendingAction({ requestID, action });
    setError(null);

    try {
      if (action === "accept") {
        await acceptFollowRequest(requestID);
      } else {
        await declineFollowRequest(requestID);
      }

      setRequests((current) =>
        current.filter((request) => request.id !== requestID),
      );
      await onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update follow request",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section>
      <h3 className={styles.cardTitle}>Follow Requests</h3>

      {loading && <p className={styles.infoLabel}>Loading requests...</p>}

      {!loading && requests.length === 0 && (
        <p className={styles.infoLabel}>No pending follow requests.</p>
      )}

      {!loading && requests.length > 0 && (
        <ul className={styles.requestList}>
          {requests.map((request) => {
            const requester = request.requester;
            const displayName = getDisplayName(
              requester.firstName,
              requester.lastName,
              requester.username,
            );
            const isAccepting =
              pendingAction?.requestID === request.id &&
              pendingAction.action === "accept";
            const isDeclining =
              pendingAction?.requestID === request.id &&
              pendingAction.action === "decline";
            const isBusy = isAccepting || isDeclining;

            return (
              <li key={request.id} className={styles.requestItem}>
                <div className={styles.requestUser}>
                  <UserAvatar
                    src={requester.profilePhoto}
                    firstName={requester.firstName}
                    lastName={requester.lastName}
                    username={requester.username}
                    size={40}
                    className={styles.userListAvatar}
                  />

                  <div className={styles.requestMeta}>
                    <Link
                      href={`/profile/${requester.username}`}
                      className={styles.userListLink}
                    >
                      {displayName}
                    </Link>
                    <span className={styles.infoLabel}>
                      @{requester.username}
                    </span>
                  </div>
                </div>

                <div className={styles.requestActions}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={isBusy}
                    onClick={() => handleRequestAction(request.id, "accept")}
                  >
                    {isAccepting ? "Saving..." : "Accept"}
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    disabled={isBusy}
                    onClick={() => handleRequestAction(request.id, "decline")}
                  >
                    {isDeclining ? "Saving..." : "Decline"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className={styles.emptyDescription}>{error}</p>}
    </section>
  );
}
