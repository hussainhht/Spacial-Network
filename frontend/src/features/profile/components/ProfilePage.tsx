"use client";

import { useEffect, useState } from "react";
import {
  followUser,
  getFollowers,
  getFollowing,
  getFollowStatus,
  getMyProfile,
  getProfileByUsername,
  unfollowUser,
  updateMyProfileAvatar,
  updateMyProfileDetails,
  updateMyProfilePrivacy,
} from "../api/profiles";
import { listPosts } from "@/features/posts/api/posts";
import { getEligibleContacts } from "@/features/chat/api/chat";
import type { Post } from "@/features/posts/types/post";
import type {
  UpdateProfileAvatarInput,
  UpdateProfileDetailsInput,
} from "../api/profiles";
import type {
  FollowStatus,
  Profile,
  ProfileTab,
  ProfileUserSummary,
} from "../types/profile";
import ProfileHeader from "./ProfileHeader";
import ProfileAbout from "./ProfileAbout";
import ProfileContent from "./ProfileContent";
import {
  ProfileLoadingState,
  ProfileErrorState,
  PrivateProfileState,
} from "./ProfileState";
import styles from "./Profile.module.css";

interface ProfilePageProps {
  username?: string;
}

const emptyFollowStatus: FollowStatus = {
  isFollowing: false,
  hasPendingRequest: false,
};

export default function ProfilePage({ username }: ProfilePageProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(!username);
  const [privacyOverride, setPrivacyOverride] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [posts, setPosts] = useState<Post[]>([]);

  const effectiveIsPrivate = Boolean(
    profile && (privacyOverride ?? profile.isPrivate),
  );
  const isLocked = Boolean(
    profile &&
      !isOwnProfile &&
      effectiveIsPrivate &&
      !profile.canViewFullProfile,
  );
  const [postsLoading, setPostsLoading] = useState(!isLocked);
  const [avatarUpdating, setAvatarUpdating] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [detailsUpdating, setDetailsUpdating] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [privacyUpdating, setPrivacyUpdating] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  const [followers, setFollowers] = useState<ProfileUserSummary[]>([]);
  const [following, setFollowing] = useState<ProfileUserSummary[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasPendingFollowRequest, setHasPendingFollowRequest] = useState(false);
  const [messageContactProfileID, setMessageContactProfileID] = useState<
    number | null
  >(null);
  const [canMessageByContact, setCanMessageByContact] = useState(false);
  const [followDataLoading, setFollowDataLoading] = useState(!isLocked);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const canMessage = Boolean(
    profile &&
      !isOwnProfile &&
      (isFollowing ||
        (messageContactProfileID === profile.id && canMessageByContact)),
  );

  // Determine messaging permission (User A follows User B OR User B follows User A)
  useEffect(() => {
    if (!profile || isOwnProfile || isFollowing) {
      return;
    }

    let isMounted = true;
    getEligibleContacts("", 1, 0, profile.id)
      .then((contacts) => {
        if (isMounted) {
          setMessageContactProfileID(profile.id);
          setCanMessageByContact(
            contacts.length > 0 && contacts[0].id === profile.id,
          );
        }
      })
      .catch(() => {
        if (isMounted) {
          setMessageContactProfileID(profile.id);
          setCanMessageByContact(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [profile, isOwnProfile, isFollowing]);

  // Load profile data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!username) {
          // Own profile (/profile)
          const myProfile = await getMyProfile();
          if (!cancelled) {
            setProfile(myProfile);
            setIsOwnProfile(true);
            setError(null);
          }
        } else {
          // Profile by username (/profile/[username])
          const [targetProfile, viewerProfile] = await Promise.all([
            getProfileByUsername(username),
            getMyProfile().catch(() => null),
          ]);

          if (!cancelled) {
            setProfile(targetProfile);
            setError(null);

            const isOwner = Boolean(
              viewerProfile &&
              (viewerProfile.username.toLowerCase() ===
                username.toLowerCase() ||
                viewerProfile.id === targetProfile.id),
            );
            setIsOwnProfile(isOwner);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load profile",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [username, reloadTrigger]);

  // Load user's posts
  useEffect(() => {
    if (!profile || isLocked) {
      return;
    }

    const profileId = profile.id;
    let isMounted = true;

    async function loadUserPosts() {
      try {
        const allPosts = await listPosts();
        if (isMounted) {
          const userPosts = allPosts.filter(
            (post) => post.user_id === profileId,
          );
          setPosts(userPosts);
        }
      } catch {
        if (isMounted) {
          setPosts([]);
        }
      } finally {
        if (isMounted) {
          setPostsLoading(false);
        }
      }
    }

    loadUserPosts();

    return () => {
      isMounted = false;
    };
  }, [profile, isLocked]);

  // Load followers/following data and current follow status.
  useEffect(() => {
    if (!profile) {
      return;
    }

    const profileUsername = profile.username;
    let isMounted = true;

    async function loadFollowData() {
      if (isMounted) {
        setFollowDataLoading(!isLocked);
      }

      try {
        const followStatusPromise = isOwnProfile
          ? Promise.resolve(emptyFollowStatus)
          : getFollowStatus(profileUsername);

        if (isLocked) {
          const followStatusResult = await followStatusPromise;

          if (isMounted) {
            setFollowers([]);
            setFollowing([]);
            setIsFollowing(followStatusResult.isFollowing);
            setHasPendingFollowRequest(followStatusResult.hasPendingRequest);
          }
          return;
        }

        const [followersResult, followingResult, followStatusResult] =
          await Promise.all([
            getFollowers(profileUsername),
            getFollowing(profileUsername),
            followStatusPromise,
          ]);

        if (isMounted) {
          setFollowers(followersResult);
          setFollowing(followingResult);
          setIsFollowing(followStatusResult.isFollowing);
          setHasPendingFollowRequest(followStatusResult.hasPendingRequest);
        }
      } catch {
        if (isMounted) {
          setFollowers([]);
          setFollowing([]);
          setIsFollowing(false);
          setHasPendingFollowRequest(false);
        }
      } finally {
        if (isMounted) {
          setFollowDataLoading(false);
        }
      }
    }

    loadFollowData();

    return () => {
      isMounted = false;
    };
  }, [profile, isLocked, isOwnProfile]);

  async function handleToggleFollow() {
    if (
      !profile ||
      isOwnProfile ||
      followLoading ||
      (!isFollowing && hasPendingFollowRequest)
    ) {
      return;
    }

    setFollowError(null);
    setFollowLoading(true);

    try {
      if (isFollowing) {
        await unfollowUser(profile.username);
      } else {
        await followUser(profile.username);
      }

      const followStatusResult = await getFollowStatus(profile.username);
      setIsFollowing(followStatusResult.isFollowing);
      setHasPendingFollowRequest(followStatusResult.hasPendingRequest);

      if (profile.isPrivate && !followStatusResult.isFollowing) {
        setProfile((current) =>
          current && current.id === profile.id
            ? { ...current, canViewFullProfile: false }
            : current,
        );
        setFollowers([]);
        setFollowing([]);
        return;
      }

      const [followersResult, followingResult] = await Promise.all([
        getFollowers(profile.username),
        getFollowing(profile.username),
      ]);

      setFollowers(followersResult);
      setFollowing(followingResult);
    } catch (err) {
      setFollowError(
        err instanceof Error ? err.message : "Failed to update follow",
      );
    } finally {
      setFollowLoading(false);
    }
  }

  async function refreshFollowLists() {
    if (!profile) {
      return;
    }

    try {
      const [followersResult, followingResult] = await Promise.all([
        getFollowers(profile.username),
        getFollowing(profile.username),
      ]);

      setFollowers(followersResult);
      setFollowing(followingResult);
    } catch {
      setFollowers([]);
      setFollowing([]);
    }
  }

  function handleRetry() {
    setLoading(true);
    setReloadTrigger((prev) => prev + 1);
  }

  async function handleTogglePrivacy() {
    if (!profile || !isOwnProfile || privacyUpdating) {
      return;
    }

    const currentPrivacy = privacyOverride ?? profile.isPrivate;
    const nextPrivacy = !currentPrivacy;

    setPrivacyUpdating(true);
    setPrivacyError(null);

    try {
      const updated = await updateMyProfilePrivacy(nextPrivacy);
      setPrivacyOverride(updated);
    } catch (err) {
      setPrivacyError(
        err instanceof Error
          ? err.message
          : "Failed to update profile privacy settings",
      );
    } finally {
      setPrivacyUpdating(false);
    }
  }

  async function handleUpdateProfileDetails(input: UpdateProfileDetailsInput) {
    if (!profile || !isOwnProfile || detailsUpdating) {
      return;
    }

    setDetailsUpdating(true);
    setDetailsError(null);

    try {
      const updatedProfile = await updateMyProfileDetails(input);
      setProfile(updatedProfile);
      setPrivacyOverride(updatedProfile.isPrivate);
    } catch (err) {
      setDetailsError(
        err instanceof Error ? err.message : "Failed to update profile details",
      );
    } finally {
      setDetailsUpdating(false);
    }
  }

  async function handleUpdateProfileAvatar(input: UpdateProfileAvatarInput) {
    if (!profile || !isOwnProfile || avatarUpdating) {
      return;
    }

    setAvatarUpdating(true);
    setAvatarError(null);

    try {
      const updatedProfile = await updateMyProfileAvatar(input);
      setProfile(updatedProfile);
      setPrivacyOverride(updatedProfile.isPrivate);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update profile photo";
      setAvatarError(message);
      throw new Error(message);
    } finally {
      setAvatarUpdating(false);
    }
  }

  function handlePostDeleted(deletedId: number) {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
  }

  if (loading) {
    return (
      <div className={styles.profilePage}>
        <ProfileLoadingState />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={styles.profilePage}>
        <div className={styles.container}>
          <ProfileErrorState
            message={error ?? "Profile not found."}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  const effectiveProfile: Profile = {
    ...profile,
    isPrivate: privacyOverride ?? profile.isPrivate,
  };

  function handleEditProfile() {
    setActiveTab("settings");

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    document.getElementById("profile-sections")?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <div className={styles.profilePage}>
      <div className={styles.container}>
        <div className={styles.identitySurface}>
          <ProfileHeader
            profile={effectiveProfile}
            isOwnProfile={isOwnProfile}
            isFollowing={isFollowing}
            hasPendingFollowRequest={hasPendingFollowRequest}
            canMessage={canMessage}
            followLoading={followLoading}
            followError={followError}
            onEditProfile={handleEditProfile}
            onToggleFollow={handleToggleFollow}
          />

          {!isLocked && (
            <ProfileAbout
              profile={effectiveProfile}
              isOwnProfile={isOwnProfile}
              onEditProfile={isOwnProfile ? handleEditProfile : undefined}
            />
          )}
        </div>

        {isLocked ? (
          <PrivateProfileState />
        ) : (
          <ProfileContent
            profile={effectiveProfile}
            isOwnProfile={isOwnProfile}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            posts={posts}
            postsLoading={postsLoading}
            onPostDeleted={handlePostDeleted}
            onTogglePrivacy={isOwnProfile ? handleTogglePrivacy : undefined}
            privacyUpdating={privacyUpdating}
            privacyError={privacyError}
            onUpdateProfileAvatar={
              isOwnProfile ? handleUpdateProfileAvatar : undefined
            }
            avatarUpdating={avatarUpdating}
            avatarError={avatarError}
            onUpdateProfileDetails={
              isOwnProfile ? handleUpdateProfileDetails : undefined
            }
            detailsUpdating={detailsUpdating}
            detailsError={detailsError}
            followers={followers}
            following={following}
            followDataLoading={followDataLoading}
            onFollowRequestsChanged={refreshFollowLists}
          />
        )}
      </div>
    </div>
  );
}
