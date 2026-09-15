import AuthenticatedProviders from "@/components/layout/AuthenticatedProviders";
import GroupSettingsShell from "@/components/layout/GroupSettingsShell";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthenticatedProviders>
      <GroupSettingsShell>{children}</GroupSettingsShell>
    </AuthenticatedProviders>
  );
}
