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
    <section className="group-panel group-posts" aria-labelledby="posts-heading">
      <div className="group-section-heading">
        <h2 id="posts-heading">Posts</h2>
        <button
          type="button"
          className="group-button secondary"
          onClick={() => setIsCreateOpen(true)}
        >
          + New Post
        </button>
      </div>
      <p className="group-muted">Posts shared with this group.</p>

      {posts.loading && !posts.data && (
        <p className="group-muted" role="status">
          Loading posts...
        </p>
      )}

      {posts.error && (
        <GroupLoadError error={posts.error} retry={posts.refresh} />
      )}

      {!posts.loading && !posts.error && posts.data?.length === 0 && (
        <div className="group-empty">
          <h3>No posts yet</h3>
          <p>
            Be the first to share something with this group.
          </p>
        </div>
      )}

      {posts.data && posts.data.length > 0 && (
        <div className="posts-list">
          {posts.data.map((post) => (
            <PostCard key={post.id} post={post} onDeleted={handleDeleted} />
          ))}
        </div>
      )}

      {isCreateOpen && (
        <CreateGroupPostModal
          groupId={groupId}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </section>
  );
}
