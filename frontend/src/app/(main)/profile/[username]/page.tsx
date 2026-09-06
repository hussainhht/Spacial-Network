import ProfilePage from "@/features/profile/components/ProfilePage";

interface ProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function Page({ params }: ProfilePageProps) {
  const { username } = await params;

  return <ProfilePage username={username} />;
}
