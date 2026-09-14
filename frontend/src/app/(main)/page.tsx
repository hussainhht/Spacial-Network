import { Suspense } from "react";
import PostFeed from "@/features/posts/components/PostFeed";

export default function Page() {
  return (
    <main className="posts-page home-feed-page" aria-labelledby="app-page-title">
      <div className="posts-container home-feed-container">
        <Suspense fallback={null}>
          <PostFeed />
        </Suspense>
      </div>
    </main>
  );
}
