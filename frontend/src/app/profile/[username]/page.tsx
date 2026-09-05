import ProfilePageContent from "@/features/profile/components/ProfilePageContent";

interface ProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;

  return <ProfilePageContent username={username} />;
}