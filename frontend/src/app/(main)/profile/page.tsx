import type { Metadata } from "next";
import PageTransition from "@/components/transitions/PageTransition";
import ProfilePage from "@/features/profile/components/ProfilePage";
import styles from "@/features/profile/components/Profile.module.css";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return (
    <PageTransition className={styles.transitionPage}>
      <ProfilePage />
    </PageTransition>
  );
}
