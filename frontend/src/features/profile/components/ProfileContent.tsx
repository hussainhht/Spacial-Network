"use client";

import AppIcon, { type AppIconName } from "@/components/layout/AppIcon";
import SegmentedTabs, {
  type SegmentedTabOption,
} from "@/components/SegmentedTabs";
import PostCard from "@/features/posts/components/PostCard";
import type { Post } from "@/features/posts/types/post";
import { parseDate } from "@/lib/utils";
import type {
  UpdateProfileAvatarInput,
  UpdateProfileDetailsInput,
} from "../api/profiles";
import type { Profile, ProfileTab, ProfileUserSummary } from "../types/profile";
import ProfileAvatarForm from "./ProfileAvatarForm";
import ProfileDetailsForm from "./ProfileDetailsForm";
import ProfileFollowRequests from "./ProfileFollowRequests";
import ProfilePrivacy from "./ProfilePrivacy";
import ProfileUserList from "./ProfileUserList";
import styles from "./Profile.module.css";

const TAB_ID_PREFIX = "profile";

// Kept at module scope so SegmentedTabs receives stable option references.
const publicTabs: readonly SegmentedTabOption<ProfileTab>[] = [
  { value: "posts", label: "Posts" },
  { value: "connections", label: "Connections" },
];

const ownerTabs: readonly SegmentedTabOption<ProfileTab>[] = [
  ...publicTabs,
  { value: "settings", label: "Edit profile" },
];

function getPanelId(tab: ProfileTab) {
  return `${TAB_ID_PREFIX}-panel-${tab}`;
}

function getTabId(tab: ProfileTab) {
  return `${TAB_ID_PREFIX}-tab-${tab}`;
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
    <div
      id={getPanelId("posts")}
      role="tabpanel"
      aria-labelledby={getTabId("posts")}
      className={styles.tabPanel}
    >
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
}

function ConnectionsTab({
  isOwnProfile,
  followers,
  following,
  loading,
  onFollowRequestsChanged,
}: ConnectionsTabProps) {
  return (
    <div
      id={getPanelId("connections")}
      role="tabpanel"
      aria-labelledby={getTabId("connections")}
      className={styles.tabPanel}
    >
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
}: SettingsTabProps) {
  const createdDate = parseDate(profile.createdAt);
  const memberSince = createdDate
    ? createdDate.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
  const accountDetails = [
    { label: "Email", value: profile.email },
    { label: "Age", value: profile.age > 0 ? String(profile.age) : "" },
    {
      label: "Gender",
      value: profile.gender
        ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)
        : "",
    },
    { label: "Joined", value: memberSince },
  ].filter((detail) => detail.value);

  return (
    <div
      id={getPanelId("settings")}
      role="tabpanel"
      aria-labelledby={getTabId("settings")}
      className={styles.tabPanel}
    >
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

          {accountDetails.length > 0 && (
            <section
              className={styles.card}
              aria-labelledby="account-details-heading"
            >
              <h3 id="account-details-heading" className={styles.cardTitle}>
                <span>Account</span>
              </h3>

              <dl className={styles.infoList}>
                {accountDetails.map((detail) => (
                  <div key={detail.label} className={styles.infoRow}>
                    <dt className={styles.infoLabel}>{detail.label}</dt>
                    <dd className={styles.infoValue}>{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
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
  const tabs = isOwnProfile ? ownerTabs : publicTabs;
  const visibleTab = tabs.some((tab) => tab.value === activeTab)
    ? activeTab
    : "posts";

  return (
    <div id="profile-sections" className={styles.sections}>
      <SegmentedTabs
        value={visibleTab}
        options={tabs}
        onChange={onTabChange}
        ariaLabel="Profile sections"
        idPrefix={TAB_ID_PREFIX}
        panelId={getPanelId}
        className={styles.tabs}
      />

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
        />
      )}
    </div>
  );
}
