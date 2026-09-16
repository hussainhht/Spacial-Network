import AuthGuard from "@/features/auth/components/AuthGuard";
import GroupStateSync from "@/features/groups/components/GroupStateSync";
import NotificationToastContainer from "@/features/notifications/components/NotificationToastContainer";
import { NotificationProvider } from "@/features/notifications/context/NotificationProvider";
import { SearchProvider } from "@/features/search/context/SearchContext";
import { ActionFeedbackProvider } from "@/components/feedback/ActionFeedbackProvider";

export default function AuthenticatedProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <NotificationProvider>
        <ActionFeedbackProvider>
          <SearchProvider>
            <GroupStateSync />
            <NotificationToastContainer />
            {children}
          </SearchProvider>
        </ActionFeedbackProvider>
      </NotificationProvider>
    </AuthGuard>
  );
}
