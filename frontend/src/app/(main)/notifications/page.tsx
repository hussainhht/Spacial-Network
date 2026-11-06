import type { Metadata } from "next";
import PageTransition from "@/components/transitions/PageTransition";
import NotificationInbox from "@/features/notifications/components/NotificationInbox";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <PageTransition>
      <main className="notifications-page space-shell">
        <NotificationInbox />
      </main>
    </PageTransition>
  );
}
