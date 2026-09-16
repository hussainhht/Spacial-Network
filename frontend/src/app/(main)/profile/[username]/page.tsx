import PageTransition from "@/components/transitions/PageTransition";
import ProfilePage from "@/features/profile/components/ProfilePage";
import styles from "@/features/profile/components/Profile.module.css";

interface ProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function Page({ params }: ProfilePageProps) {
  const { username } = await params;

  return (
    <PageTransition className={styles.transitionPage}>
      <ProfilePage username={username} />
    </PageTransition>
  );
}
