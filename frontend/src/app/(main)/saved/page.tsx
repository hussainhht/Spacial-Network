import type { Metadata } from "next";
import PageTransition from "@/components/transitions/PageTransition";
import SavedPostsFeed from "@/features/saved/components/SavedPostsFeed";
import styles from "@/features/saved/components/SavedPostsFeed.module.css";

export const metadata: Metadata = { title: "Saved Posts" };

export default function SavedPostsPage() {
  return (
    <PageTransition>
      <main className={`posts-page ${styles.page}`} aria-labelledby="saved-posts-heading">
        <div className={styles.column} data-motion-section>
          <SavedPostsFeed />
        </div>
      </main>
    </PageTransition>
  );
}
