import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppIcon from "@/components/layout/AppIcon";
import PostFeed from "@/features/posts/components/PostFeed";
import styles from "@/components/layout/AppShell.module.css";

export default function Home() {
  return (
    <div className={styles.home}>
      <AppHeader />
      <main className={styles.homeContent}>
        <section className={styles.welcome} aria-labelledby="home-title">
          <span className={styles.eyebrow}>YOUR CORNER OF THE COSMOS</span>
          <h1 id="home-title">Good to have you here<span>.</span></h1>
          <p>Small moments. New conversations. A universe of connections.</p>
          <span className={styles.previewBadge}>Development preview</span>
          <div className={styles.orbitArt} aria-hidden="true"><span /><i /></div>
        </section>

        <div className={styles.quickLinks}>
          <Link href="/groups"><span className={styles.quickIcon}><AppIcon name="groups" /></span><span><strong>Find your people</strong><small>Explore groups</small></span><AppIcon name="arrow" /></Link>
          <Link href="/chat"><span className={styles.quickIcon}><AppIcon name="chat" /></span><span><strong>Keep in touch</strong><small>Open messages</small></span><AppIcon name="arrow" /></Link>
        </div>

        <section className={styles.feed} aria-labelledby="feed-title">
          <header className={styles.feedHeader}>
            <div><span className={styles.eyebrow}>THE LATEST IN YOUR SPACE</span><h2 id="feed-title">Home feed</h2></div>
            <Link href="/posts/new" className={styles.primaryLink}><AppIcon name="plus" />New post</Link>
          </header>
          <PostFeed />
        </section>
        <footer className={styles.homeFooter}><AppIcon name="orbit" />A shared space, taking shape.</footer>
      </main>
    </div>
  );
}
