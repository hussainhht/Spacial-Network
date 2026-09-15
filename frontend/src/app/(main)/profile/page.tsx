import PageTransition from "@/components/transitions/PageTransition";
import ProfilePage from "@/features/profile/components/ProfilePage";

export default function Page() {
  return (
    <PageTransition>
      <ProfilePage />
    </PageTransition>
  );
}
