"use client";

import PostCard from "@/features/posts/components/PostCard";
import type { Post } from "@/features/posts/types/post";
import type { Profile, ProfileTab } from "../types/profile";
import ProfilePrivacy from "./ProfilePrivacy";
import styles from "./Profile.module.css";

interface TabsProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  postsCount?: number;
}

function ProfileTabs({ activeTab, onTabChange, postsCount }: TabsProps) {
  const tabs: { id: ProfileTab; label: string; count?: number }[] = [
    { id: "posts", label: "Posts", count: postsCount },
    { id: "about", label: "About" },
  ];

  return (
    <nav
      className={styles.tabsContainer}
      role="tablist"
      aria-label="Profile navigation tabs"
    >
      {tabs.map((tab) => {
        const isSelected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={isSelected ? 0 : -1}
            className={styles.tabButton}
            onClick={() => onTabChange(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={styles.tabBadge}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

interface PostsTabProps {
  posts: Post[];
  loading: boolean;
  onPostDeleted: (id: number) => void;
}

function PostsTab({ posts, loading, onPostDeleted }: PostsTabProps) {
  return (
    <div
      id="panel-posts"
      role="tabpanel"
      aria-labelledby="tab-posts"
      className={styles.tabContent}
    >
      {loading && (
        <div className={styles.emptyCard} role="status">
          <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconCircle} aria-hidden="true">
            📝
          </div>
          <h3 className={styles.emptyTitle}>No posts yet</h3>
          <p className={styles.emptyDescription}>
            Posts created by this user will appear here.
          </p>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div className="posts-list">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDeleted={onPostDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}

interface AboutTabProps {
  profile: Profile;
  isOwnProfile: boolean;
  onTogglePrivacy?: () => Promise<void>;
  privacyUpdating?: boolean;
  privacyError?: string | null;
}

function AboutTab({
  profile,
  isOwnProfile,
  onTogglePrivacy,
  privacyUpdating = false,
  privacyError = null,
}: AboutTabProps) {
  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div
      id="panel-about"
      role="tabpanel"
      aria-labelledby="tab-about"
      className={styles.tabContent}
    >
      <div className={styles.aboutGrid}>
        <section
          className={styles.card}
          aria-labelledby="personal-info-heading"
        >
          <h3 id="personal-info-heading" className={styles.cardTitle}>
            <span>Personal Information</span>
          </h3>

          <div className={styles.infoList}>
            {profile.email && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Email</span>
                <span className={styles.infoValue}>{profile.email}</span>
              </div>
            )}

            {profile.age !== undefined && profile.age > 0 && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Age</span>
                <span className={styles.infoValue}>{profile.age}</span>
              </div>
            )}

            {profile.gender && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Gender</span>
                <span className={styles.infoValue}>
                  {profile.gender.charAt(0).toUpperCase() +
                    profile.gender.slice(1)}
                </span>
              </div>
            )}

            {memberSince && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Joined</span>
                <span className={styles.infoValue}>{memberSince}</span>
              </div>
            )}

            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Visibility</span>
              <span className={styles.infoValue}>
                {profile.isPrivate ? "Private" : "Public"}
              </span>
            </div>
          </div>
        </section>

        {isOwnProfile && onTogglePrivacy && (
          <ProfilePrivacy
            isPrivate={profile.isPrivate}
            onTogglePrivacy={onTogglePrivacy}
            updating={privacyUpdating}
            error={privacyError}
          />
        )}
      </div>
    </div>
  );
}

interface ProfileContentProps {
  profile: Profile;
  isOwnProfile: boolean;
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  posts: Post[];
  postsLoading: boolean;
  onPostDeleted: (id: number) => void;
  onTogglePrivacy?: () => Promise<void>;
  privacyUpdating?: boolean;
  privacyError?: string | null;
}

export default function ProfileContent({
  profile,
  isOwnProfile,
  activeTab,
  onTabChange,
  posts,
  postsLoading,
  onPostDeleted,
  onTogglePrivacy,
  privacyUpdating,
  privacyError,
}: ProfileContentProps) {
  return (
    <>
      <ProfileTabs
        activeTab={activeTab}
        onTabChange={onTabChange}
        postsCount={posts.length}
      />

      {activeTab === "posts" && (
        <PostsTab
          posts={posts}
          loading={postsLoading}
          onPostDeleted={onPostDeleted}
        />
      )}

      {activeTab === "about" && (
        <AboutTab
          profile={profile}
          isOwnProfile={isOwnProfile}
          onTogglePrivacy={onTogglePrivacy}
          privacyUpdating={privacyUpdating}
          privacyError={privacyError}
        />
      )}
    </>
  );
}
