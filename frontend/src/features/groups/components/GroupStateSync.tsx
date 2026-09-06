"use client";
import { useEffect } from "react";
import { useWebSocket } from "@/providers/WebSocketProvider";
import { getGroupNotificationData } from "@/features/notifications/types/notification";
import { refreshGroupData } from "../hooks/useGroupData";

export default function GroupStateSync() {
  const { isConnected, subscribeNotifications } = useWebSocket();
  useEffect(
    () =>
      subscribeNotifications((event) => {
        if (
          event.type === "group_invitation" ||
          event.type === "group_join_request"
        )
          void refreshGroupData(getGroupNotificationData(event)?.group_id);
      }),
    [subscribeNotifications],
  );
  useEffect(() => {
    if (isConnected) void refreshGroupData();
  }, [isConnected]);
  useEffect(() => {
    const focus = () => {
      void refreshGroupData();
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, []);
  return null;
}
