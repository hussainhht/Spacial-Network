import Link from "next/link";
import PostFeed from "@/features/posts/components/PostFeed";

export default function PostsPage() {
  return (
    <main className="posts-page">
      <div className="posts-container">
        <header className="posts-page-header">
          <h1>Posts</h1>
          <Link href="/posts/new" className="new-post-link">New post</Link>
        </header>
        <PostFeed />
      </div>
    </main>
  );
}
