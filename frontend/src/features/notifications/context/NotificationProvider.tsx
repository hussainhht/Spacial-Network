"use client";

import { createContext, useContext } from "react";
import {
  useNotificationSync,
  type NotificationSyncState,
} from "../hooks/useNotificationSync";

const NotificationContext = createContext<NotificationSyncState | undefined>(
  undefined,
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const notificationState = useNotificationSync();

  return (
    <NotificationContext.Provider value={notificationState}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context)
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  return context;
}
