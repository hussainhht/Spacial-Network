"use client";

import { useState } from "react";
import { removeGroupPost, useGroupPosts } from "../hooks/useGroupData";
import PostCard from "@/features/posts/components/PostCard";
import { GroupLoadError } from "./GroupPanels";
import CreateGroupPostModal from "./CreateGroupPostModal";

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
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  function handleDeleted(postId: number) {
    removeGroupPost(groupId, postId);
  }

  return (
    <>
      <section
        className="group-panel group-post-composer"
        aria-label="Create a post"
      >
        <button
          type="button"
          className="group-composer-trigger"
          onClick={() => setIsCreateOpen(true)}
        >
          <span className="group-composer-avatar" aria-hidden="true">
            +
          </span>
          <span className="group-composer-placeholder">
            Share something with the group…
          </span>
        </button>
        <div className="group-composer-actions">
          <button
            type="button"
            className="group-composer-action"
            onClick={() => setIsCreateOpen(true)}
          >
            + Add Image
          </button>
          <button
            type="button"
            className="group-button"
            onClick={() => setIsCreateOpen(true)}
          >
            Post
          </button>
        </div>
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
              onClick={() => setIsCreateOpen(true)}
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

      {isCreateOpen && (
        <CreateGroupPostModal
          groupId={groupId}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </>
  );
}
