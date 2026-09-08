import AppHeader from "@/components/layout/AppHeader";
import HomeEarth from "@/components/space/HomeEarth";
import styles from "@/components/layout/AppShell.module.css";

export default function Home() {
  return (
    <div className={styles.home}>
      <AppHeader />
      <main className={styles.homeContent} aria-label="Home page">
        <HomeEarth />
      </main>
    </div>
  );
}
