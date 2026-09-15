"use client";

import { useNotificationToasts } from "../hooks/useNotificationToasts";
import NotificationToast from "./NotificationToast";

export default function NotificationToastContainer() {
  const { toasts, dismiss } = useNotificationToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="notification-toast-container" aria-live="polite">
      {toasts.map(({ toastId, notification, leaving }) => (
        <NotificationToast
          key={toastId}
          notification={notification}
          leaving={leaving}
          onDismiss={() => dismiss(toastId)}
        />
      ))}
    </div>
  );
}
