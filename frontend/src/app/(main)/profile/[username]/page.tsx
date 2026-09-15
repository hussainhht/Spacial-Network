import PageTransition from "@/components/transitions/PageTransition";
import ProfilePage from "@/features/profile/components/ProfilePage";

interface ProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function Page({ params }: ProfilePageProps) {
  const { username } = await params;

  return (
    <PageTransition>
      <ProfilePage username={username} />
    </PageTransition>
  );
}
