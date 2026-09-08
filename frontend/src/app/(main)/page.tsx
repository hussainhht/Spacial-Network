import TopNavbar from "@/components/layout/TopNavbar";
import HomeOrbitalFeed from "@/features/posts/components/home/HomeOrbitalFeed";
import SpaceBackground from "@/components/space/SpaceBackground";
import styles from "@/components/layout/AppShell.module.css";

export default function Home() {
  return (
    <div className={styles.home} data-universe-scene="home">
      <SpaceBackground />
      <TopNavbar />
      <main className={styles.homeContent} aria-label="Home page">
        <HomeOrbitalFeed />
      </main>
    </div>
  );
}
