import AuthGuard from "@/features/auth/components/AuthGuard";
import GroupStateSync from "@/features/groups/components/GroupStateSync";
import NotificationToastContainer from "@/features/notifications/components/NotificationToastContainer";
import { NotificationProvider } from "@/features/notifications/context/NotificationProvider";
import { SearchProvider } from "@/features/search/context/SearchContext";

export default function AuthenticatedProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <NotificationProvider>
        <SearchProvider>
          <GroupStateSync />
          <NotificationToastContainer />
          {children}
        </SearchProvider>
      </NotificationProvider>
    </AuthGuard>
  );
}
