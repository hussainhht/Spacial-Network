import PostFeed from "@/features/posts/components/PostFeed";

export default function Page() {
  return (
    <main className="posts-page" aria-labelledby="app-page-title">
      <div className="posts-container">
        <PostFeed />
      </div>
    </main>
  );
}
