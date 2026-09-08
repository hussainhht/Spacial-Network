import HomeOrbitalFeed from "@/features/posts/components/home/HomeOrbitalFeed";
import styles from "@/components/layout/AppShell.module.css";

export default function Home() {
  return (
    <div className={styles.home} data-universe-scene="home">
      <main className={styles.homeContent} aria-label="Home page">
        <HomeOrbitalFeed />
      </main>
    </div>
  );
}
