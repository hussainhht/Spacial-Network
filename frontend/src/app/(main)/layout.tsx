import GroupStateSync from "@/features/groups/components/GroupStateSync";
import AppShell from "@/components/layout/AppShell";
import { NotificationProvider } from "@/features/notifications/context/NotificationProvider";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <NotificationProvider>
      <GroupStateSync />
      <AppShell>{children}</AppShell>
    </NotificationProvider>
  );
}
