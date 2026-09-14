import GroupStateSync from "@/features/groups/components/GroupStateSync";
import AppShell from "@/components/layout/AppShell";
import { NotificationProvider } from "@/features/notifications/context/NotificationProvider";
import { SearchProvider } from "@/features/search/context/SearchContext";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <NotificationProvider>
      <SearchProvider>
        <GroupStateSync />
        <AppShell>{children}</AppShell>
      </SearchProvider>
    </NotificationProvider>
  );
}
