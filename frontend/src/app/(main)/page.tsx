import { Suspense } from "react";
import PageTransition from "@/components/transitions/PageTransition";
import PostFeed from "@/features/posts/components/PostFeed";
import HomeDiscovery from "@/features/recommendations/components/HomeDiscovery";
import styles from "./HomePage.module.css";

export default function Page() {
  return (
    <PageTransition>
      <main className={`posts-page home-feed-page ${styles.page}`} aria-labelledby="app-page-title">
        <div className={styles.layout} data-motion-section>
          <div className={styles.feed}>
            <Suspense fallback={null}>
              <PostFeed
                stickyFilters
                inlineDiscovery={
                  <div className={styles.inlineDiscovery}>
                    <HomeDiscovery placement="inline" />
                  </div>
                }
              />
            </Suspense>
          </div>
          <aside className={styles.recommendations} aria-label="Recommendations">
            <HomeDiscovery placement="desktop" />
          </aside>
        </div>
      </main>
    </PageTransition>
  );
}
