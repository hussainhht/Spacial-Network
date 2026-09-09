"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { deletePost } from "@/features/posts/api/posts";
import type { Post } from "@/features/posts/types/post";
import { formatDateTime } from "@/lib/utils";
import { getBackendBaseUrl } from "@/lib/api";
import PostAuthorLink from "./PostAuthorLink";

interface PostCardProps {
  post: Post;
  onDeleted: (id: number) => void;
}

export default function PostCard({ post, onDeleted }: PostCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!window.confirm("Delete this post? This cannot be undone.")) {
      return;
    }

    setError("");
    setDeleting(true);

    try {
      await deletePost(post.id);
      onDeleted(post.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post");
      setDeleting(false);
    }
  }

  return (
    <article className="post-card">
      <PostAuthorLink author={post.author} />

      <header className="post-card-header">
        <h2>
          <Link href={`/posts/${post.id}`}>{post.title}</Link>
        </h2>
        {post.visibility === "followers" && (
          <span className="post-badge">Followers only</span>
        )}
        {post.visibility === "custom" && (
          <span className="post-badge">Custom audience</span>
        )}
        {post.group_id != null && (
          <Link href={`/groups/${post.group_id}`} className="post-badge">
            Posted in group
          </Link>
        )}
        {post.author_left_group && (
          <span className="post-badge">Author left the group</span>
        )}
      </header>

      <p className="post-card-content">{post.content}</p>

      {post.image_url && (
        <Image
          className="post-card-image"
          src={`${getBackendBaseUrl()}${post.image_url}`}
          alt=""
          width={800}
          height={450}
          style={{ width: "100%", height: "auto" }}
        />
      )}

      <footer className="post-card-footer">
        <time dateTime={post.created_at}>
          {formatDateTime(post.created_at)}
        </time>

        {(post.is_owner || post.can_delete) && (
          <div className="post-card-actions">
            {post.is_owner && <Link href={`/posts/${post.id}/edit`}>Edit</Link>}
            {post.can_delete && (
              <button type="button" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
        )}
      </footer>

      {error && <p className="form-error">{error}</p>}
    </article>
  );
}
