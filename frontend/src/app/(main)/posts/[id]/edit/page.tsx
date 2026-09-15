"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageTransition from "@/components/transitions/PageTransition";
import { getPost, updatePost } from "@/features/posts/api/posts";
import { ApiError } from "@/lib/api/errors";
import type { Post } from "@/features/posts/types/post";
import PostForm from "@/features/posts/components/PostForm";

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const postId = Number(params.id);

  const validId = Number.isFinite(postId);

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(validId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!validId) return;

    let cancelled = false;

    async function load() {
      try {
        const data = await getPost(postId);
        if (cancelled) return;

        if (!data.is_owner) {
          router.push(`/posts/${postId}`);
          return;
        }

        setPost(data);
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

  async function handleSubmit(input: {
    title: string;
    content: string;
    visibility: Post["visibility"];
    viewerIds: number[];
    image?: File | null;
  }) {
    await updatePost(postId, {
      title: input.title,
      content: input.content,
      visibility: input.visibility,
      viewerIds: input.viewerIds,
    });
    router.push(`/posts/${postId}`);
  }

  return (
    <PageTransition>
      <main className="new-post-page">
        <div className="new-post-container" data-motion-section>
          <Link href={`/posts/${postId}`} className="back-link">
            &larr; Back to post
          </Link>

          <h1>Edit post</h1>

          {!validId && <p className="form-error">Invalid post id</p>}
          {loading && <p>Loading post...</p>}
          {error && <p className="form-error">{error}</p>}

          {post && (
            <PostForm
              initialValues={{
                title: post.title,
                content: post.content,
                visibility: post.visibility,
                viewerIds: post.viewer_ids ?? [],
              }}
              submitLabel="Save changes"
              pendingLabel="Saving..."
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </main>
    </PageTransition>
  );
}
