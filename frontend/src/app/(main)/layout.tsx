import AppShell from "@/components/layout/AppShell";
import AuthenticatedProviders from "@/components/layout/AuthenticatedProviders";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthenticatedProviders>
      <AppShell>{children}</AppShell>
    </AuthenticatedProviders>
  );
}
