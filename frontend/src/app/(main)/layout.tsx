import GroupStateSync from "@/features/groups/components/GroupStateSync";
import AppShell from "@/components/layout/AppShell";
import { NotificationProvider } from "@/features/notifications/context/NotificationProvider";
import NotificationToastContainer from "@/features/notifications/components/NotificationToastContainer";
import { SearchProvider } from "@/features/search/context/SearchContext";
import AuthGuard from "@/features/auth/components/AuthGuard";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <NotificationProvider>
        <SearchProvider>
          <GroupStateSync />
          <NotificationToastContainer />
          <AppShell>{children}</AppShell>
        </SearchProvider>
      </NotificationProvider>
    </AuthGuard>
  );
}
