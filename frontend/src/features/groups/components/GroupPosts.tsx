"use client";

import { type FormEvent, useRef, useState } from "react";
import { removeGroupPost, useGroupPosts } from "../hooks/useGroupData";
import { useGroupAction } from "../hooks/useGroupAction";
import PostCard from "@/features/posts/components/PostCard";
import { createGroupPost } from "@/features/posts/api/posts";
import ImageAttachmentField from "@/components/ImageAttachmentField";
import { GroupLoadError } from "./GroupPanels";

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 10000;

interface GroupPostsProps {
  groupId: number;
  isMember: boolean;
}

export default function GroupPosts({ groupId, isMember }: GroupPostsProps) {
  if (!isMember) {
    return (
      <section className="group-panel group-member-only" aria-labelledby="posts-heading">
        <span className="group-member-only-icon" aria-hidden="true">🔒</span>
        <h2 id="posts-heading">Group posts are member-only</h2>
        <p className="group-muted">Join this group to read and take part in its conversations.</p>
      </section>
    );
  }

  return <MemberGroupPosts groupId={groupId} />;
}

function MemberGroupPosts({ groupId }: { groupId: number }) {
  const posts = useGroupPosts(groupId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageFieldKey, setImageFieldKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const { busy, error, run } = useGroupAction(
    `create-group-post:${groupId}`,
    groupId,
  );

  function expandComposer() {
    setIsExpanded(true);
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) {
      setFormError("Title and content cannot be empty.");
      return;
    }

    setFormError(null);
    const ok = await run("Posting…", async () => {
      await createGroupPost(groupId, {
        title: trimmedTitle,
        content: trimmedContent,
        image,
      });
    });
    if (!ok) return;

    setTitle("");
    setContent("");
    setImage(null);
    setImageFieldKey((key) => key + 1);
    setIsExpanded(false);
  }

  function handleDeleted(postId: number) {
    removeGroupPost(groupId, postId);
  }

  return (
    <>
      <section className={`group-panel group-post-composer${isExpanded ? " is-expanded" : ""}`} aria-label="Create a post">
        {!isExpanded ? (
          <button
            type="button"
            className="group-composer-trigger"
            onClick={expandComposer}
            aria-expanded="false"
          >
            <span className="group-composer-avatar" aria-hidden="true">+</span>
            <span className="group-composer-placeholder">Share something with the group…</span>
          </button>
        ) : (
          <form className="group-inline-composer" onSubmit={handleSubmit}>
            <div className="group-inline-field">
              <label htmlFor={`group-post-title-${groupId}`}>Title</label>
              <input
                ref={titleRef}
                id={`group-post-title-${groupId}`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Post title…"
                maxLength={MAX_TITLE_LENGTH}
                required
              />
            </div>
            <div className="group-inline-field">
              <label htmlFor={`group-post-content-${groupId}`}>Content</label>
              <textarea
                id={`group-post-content-${groupId}`}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Share something with the group…"
                maxLength={MAX_CONTENT_LENGTH}
                rows={4}
                required
              />
            </div>
            <ImageAttachmentField
              key={imageFieldKey}
              id={`group-post-image-${groupId}`}
              label="Image (optional)"
              onChange={setImage}
            />
            {(formError || error) && <p className="form-error" role="alert">{formError ?? error}</p>}
            <div className="group-composer-actions">
              <button type="button" className="group-composer-collapse" onClick={() => setIsExpanded(false)} disabled={Boolean(busy)}>
                Collapse
              </button>
              <button type="submit" className="group-button" disabled={Boolean(busy) || !title.trim() || !content.trim()}>
                {busy ?? "Post"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="group-panel group-posts" aria-labelledby="posts-list-heading">
        <div className="group-section-heading">
          <h2 id="posts-list-heading">Posts</h2>
        </div>

        {posts.loading && !posts.data && (
          <p className="group-muted" role="status">
            Loading posts...
          </p>
        )}

        {posts.error && (
          <GroupLoadError error={posts.error} retry={posts.refresh} />
        )}

        {!posts.loading && !posts.error && posts.data?.length === 0 && (
          <div className="group-empty group-posts-empty">
            <h3>No posts yet</h3>
            <p>Be the first to start a conversation in this group.</p>
            <button
              type="button"
              className="group-button secondary"
              onClick={expandComposer}
            >
              Create Post
            </button>
          </div>
        )}

        {posts.data && posts.data.length > 0 && (
          <div className="posts-list">
            {posts.data.map((post) => (
              <PostCard key={post.id} post={post} onDeleted={handleDeleted} />
            ))}
          </div>
        )}
      </section>

    </>
  );
}
