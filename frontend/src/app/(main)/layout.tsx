import AppShell from "@/components/layout/AppShell";
import { NotificationProvider } from "@/features/notifications/context/NotificationProvider";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <NotificationProvider>
      <AppShell>{children}</AppShell>
    </NotificationProvider>
  );
}
