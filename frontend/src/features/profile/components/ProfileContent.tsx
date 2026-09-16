"use client";

import AppIcon, { type AppIconName } from "@/components/layout/AppIcon";
import PostCard from "@/features/posts/components/PostCard";
import type { Post } from "@/features/posts/types/post";
import type {
  UpdateProfileAvatarInput,
  UpdateProfileDetailsInput,
} from "../api/profiles";
import type { Profile, ProfileTab, ProfileUserSummary } from "../types/profile";
import ProfileAccountCard from "./ProfileAccountCard";
import ProfileAvatarForm from "./ProfileAvatarForm";
import ProfileDetailsForm from "./ProfileDetailsForm";
import ProfileFollowRequests from "./ProfileFollowRequests";
import ProfilePrivacy from "./ProfilePrivacy";
import ProfileUserList from "./ProfileUserList";
import styles from "./Profile.module.css";

interface BackToPostsProps {
  onTabChange: (tab: ProfileTab) => void;
}

function BackToPosts({ onTabChange }: BackToPostsProps) {
  return (
    <button
      type="button"
      className={styles.backButton}
      onClick={() => onTabChange("posts")}
    >
      <AppIcon name="arrowLeft" width={16} height={16} />
      Back to profile
    </button>
  );
}

interface EmptyStateProps {
  icon: AppIconName;
  title: string;
  description: string;
}

function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className={styles.emptyCard}>
      <span className={styles.emptyIconCircle} aria-hidden="true">
        <AppIcon name={icon} />
      </span>
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.emptyDescription}>{description}</p>
    </div>
  );
}

interface PostsTabProps {
  posts: Post[];
  loading: boolean;
  onPostDeleted: (id: number) => void;
}

function PostsTab({ posts, loading, onPostDeleted }: PostsTabProps) {
  return (
    <div className={styles.tabPanel}>
      {loading && (
        <div role="status" aria-label="Loading posts">
          <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
        </div>
      )}

      {!loading && posts.length === 0 && (
        <EmptyState
          icon="posts"
          title="No posts yet"
          description="Posts shared by this user will appear here."
        />
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

interface ConnectionsTabProps {
  isOwnProfile: boolean;
  followers: ProfileUserSummary[];
  following: ProfileUserSummary[];
  loading: boolean;
  onFollowRequestsChanged?: () => void | Promise<void>;
  onTabChange: (tab: ProfileTab) => void;
}

function ConnectionsTab({
  isOwnProfile,
  followers,
  following,
  loading,
  onFollowRequestsChanged,
  onTabChange,
}: ConnectionsTabProps) {
  return (
    <div className={styles.tabPanel}>
      <BackToPosts onTabChange={onTabChange} />

      {isOwnProfile && (
        <div className={styles.card}>
          <ProfileFollowRequests onChanged={onFollowRequestsChanged} />
        </div>
      )}

      {loading ? (
        <div
          className={styles.connectionsGrid}
          role="status"
          aria-label="Loading connections"
        >
          <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
          <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
        </div>
      ) : (
        <div className={styles.connectionsGrid}>
          <div className={styles.card}>
            <ProfileUserList
              title="Followers"
              users={followers}
              emptyMessage="No followers yet."
            />
          </div>
          <div className={styles.card}>
            <ProfileUserList
              title="Following"
              users={following}
              emptyMessage="Not following anyone yet."
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface SettingsTabProps {
  profile: Profile;
  onTogglePrivacy?: () => Promise<void>;
  privacyUpdating?: boolean;
  privacyError?: string | null;
  onUpdateProfileAvatar?: (input: UpdateProfileAvatarInput) => Promise<void>;
  avatarUpdating?: boolean;
  avatarError?: string | null;
  onUpdateProfileDetails?: (input: UpdateProfileDetailsInput) => Promise<void>;
  detailsUpdating?: boolean;
  detailsError?: string | null;
  onTabChange: (tab: ProfileTab) => void;
}

function SettingsTab({
  profile,
  onTogglePrivacy,
  privacyUpdating = false,
  privacyError = null,
  onUpdateProfileAvatar,
  avatarUpdating = false,
  avatarError = null,
  onUpdateProfileDetails,
  detailsUpdating = false,
  detailsError = null,
  onTabChange,
}: SettingsTabProps) {
  return (
    <div className={styles.tabPanel}>
      <BackToPosts onTabChange={onTabChange} />

      <div className={styles.settingsGrid}>
        <div className={styles.settingsColumn}>
          {onUpdateProfileDetails && (
            <ProfileDetailsForm
              key={[
                profile.id,
                profile.firstName,
                profile.lastName,
                profile.nickname,
                profile.aboutMe,
                profile.dateOfBirth,
              ].join(":")}
              profile={profile}
              onSave={onUpdateProfileDetails}
              saving={detailsUpdating}
              error={detailsError}
            />
          )}
        </div>

        <div className={styles.settingsColumn}>
          {onUpdateProfileAvatar && (
            <ProfileAvatarForm
              key={`${profile.id}:${profile.profilePhoto ?? ""}`}
              profile={profile}
              onSave={onUpdateProfileAvatar}
              saving={avatarUpdating}
              error={avatarError}
            />
          )}

          {onTogglePrivacy && (
            <ProfilePrivacy
              isPrivate={profile.isPrivate}
              onTogglePrivacy={onTogglePrivacy}
              updating={privacyUpdating}
              error={privacyError}
            />
          )}

          <ProfileAccountCard profile={profile} />
        </div>
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
  onUpdateProfileAvatar?: (input: UpdateProfileAvatarInput) => Promise<void>;
  avatarUpdating?: boolean;
  avatarError?: string | null;
  onUpdateProfileDetails?: (input: UpdateProfileDetailsInput) => Promise<void>;
  detailsUpdating?: boolean;
  detailsError?: string | null;
  followers: ProfileUserSummary[];
  following: ProfileUserSummary[];
  followDataLoading?: boolean;
  onFollowRequestsChanged?: () => void | Promise<void>;
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
  onUpdateProfileAvatar,
  avatarUpdating,
  avatarError,
  onUpdateProfileDetails,
  detailsUpdating,
  detailsError,
  followers,
  following,
  followDataLoading = false,
  onFollowRequestsChanged,
}: ProfileContentProps) {
  const visibleTab =
    !isOwnProfile && activeTab === "settings" ? "posts" : activeTab;

  return (
    <div id="profile-sections" className={styles.sections}>
      {visibleTab === "posts" && (
        <PostsTab
          posts={posts}
          loading={postsLoading}
          onPostDeleted={onPostDeleted}
        />
      )}

      {visibleTab === "connections" && (
        <ConnectionsTab
          isOwnProfile={isOwnProfile}
          followers={followers}
          following={following}
          loading={followDataLoading}
          onFollowRequestsChanged={onFollowRequestsChanged}
          onTabChange={onTabChange}
        />
      )}

      {visibleTab === "settings" && (
        <SettingsTab
          profile={profile}
          onTogglePrivacy={onTogglePrivacy}
          privacyUpdating={privacyUpdating}
          privacyError={privacyError}
          onUpdateProfileAvatar={onUpdateProfileAvatar}
          avatarUpdating={avatarUpdating}
          avatarError={avatarError}
          onUpdateProfileDetails={onUpdateProfileDetails}
          detailsUpdating={detailsUpdating}
          detailsError={detailsError}
          onTabChange={onTabChange}
        />
      )}
    </div>
  );
}
