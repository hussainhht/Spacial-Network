"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listPosts } from "@/features/posts/api/posts";
import { ApiError } from "@/lib/api/errors";
import type { Post } from "@/features/posts/types/post";
import PostCard from "@/features/posts/components/PostCard";

export default function PostsPage() {
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await listPosts();
        if (!cancelled) setPosts(data);
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to load posts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleDeleted(id: number) {
    setPosts((current) => current.filter((post) => post.id !== id));
  }

  return (
    <main className="posts-page">
      <div className="posts-container">
        <header className="posts-page-header">
          <h1>Posts</h1>
          <Link href="/posts/new" className="new-post-link">
            New post
          </Link>
        </header>

        {loading && <p>Loading posts...</p>}
        {error && <p className="form-error">{error}</p>}

        {!loading && !error && posts.length === 0 && (
          <p>No posts yet. Be the first to share something.</p>
        )}

        <div className="posts-list">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDeleted={handleDeleted} />
          ))}
        </div>
      </div>
    </main>
  );
}
