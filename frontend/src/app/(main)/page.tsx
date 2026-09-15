import { Suspense } from "react";
import PageTransition from "@/components/transitions/PageTransition";
import PostFeed from "@/features/posts/components/PostFeed";

export default function Page() {
  return (
    <PageTransition>
      <main className="posts-page home-feed-page" aria-labelledby="app-page-title">
        <div className="posts-container home-feed-container" data-motion-section>
          <Suspense fallback={null}>
            <PostFeed />
          </Suspense>
        </div>
      </main>
    </PageTransition>
  );
}
