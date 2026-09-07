"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { deletePost, getPost } from "@/features/posts/api/posts";
import { ApiError } from "@/lib/api/errors";
import type { Post } from "@/features/posts/types/post";
import CommentsSection from "@/features/comments/components/CommentsSection";
import { getBackendBaseUrl } from "@/lib/api";

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const postId = Number(params.id);

  const validId = Number.isFinite(postId);

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(validId);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!validId) return;

    let cancelled = false;

    async function load() {
      try {
        const data = await getPost(postId);
        if (!cancelled) setPost(data);
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to load post");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [postId, validId, router]);

  async function handleDelete() {
    if (!post) return;
    if (!window.confirm("Delete this post? This cannot be undone.")) return;

    setDeleting(true);
    try {
      await deletePost(post.id);
      router.push("/posts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post");
      setDeleting(false);
    }
  }

  return (
    <main className="posts-page">
      <div className="posts-container">
        <Link href="/posts" className="back-link">
          &larr; Back to posts
        </Link>

        {!validId && <p className="form-error">Invalid post id</p>}
        {loading && <p>Loading post...</p>}
        {error && <p className="form-error">{error}</p>}

        {post && (
          <article className="post-card post-detail">
            <header className="post-card-header">
              <h1>{post.title}</h1>
              {post.private && <span className="post-badge">Private</span>}
            </header>

            <p className="post-card-content">{post.content}</p>

            {post.image_url && (
              <Image
                className="post-card-image"
                src={`${getBackendBaseUrl()}${post.image_url}`}
                alt=""
                width={1000}
                height={562}
                style={{ width: "100%", height: "auto" }}
              />
            )}

            <footer className="post-card-footer">
              <time dateTime={post.created_at}>
                {new Date(post.created_at).toLocaleString()}
              </time>

              {post.is_owner && (
                <div className="post-card-actions">
                  <Link href={`/posts/${post.id}/edit`}>Edit</Link>
                  <button type="button" onClick={handleDelete} disabled={deleting}>
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              )}
            </footer>
          </article>
        )}

        {post && <CommentsSection postId={post.id} />}
      </div>
    </main>
  );
}
