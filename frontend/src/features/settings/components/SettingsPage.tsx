"use client";

import { useEffect, useState } from "react";
import SegmentedTabs, {
  type SegmentedTabOption,
} from "@/components/SegmentedTabs";
import { useActionFeedback } from "@/components/feedback/ActionFeedbackProvider";
import { useLogout } from "@/components/layout/useLogout";
import { useCurrentUser } from "@/features/auth/context/CurrentUserContext";
import {
  getMyProfile,
  updateMyProfileAvatar,
  updateMyProfileDetails,
  updateMyProfilePrivacy,
  type UpdateProfileAvatarInput,
  type UpdateProfileDetailsInput,
} from "@/features/profile/api/profiles";
import ProfileAccountCard from "@/features/profile/components/ProfileAccountCard";
import ProfileAvatarForm from "@/features/profile/components/ProfileAvatarForm";
import ProfileDetailsForm from "@/features/profile/components/ProfileDetailsForm";
import type { Profile } from "@/features/profile/types/profile";
import UserAvatar from "@/components/UserAvatar";
import AppIcon from "@/components/layout/AppIcon";
import AppearanceSettings from "./AppearanceSettings";
import PasswordForm from "./PasswordForm";
import styles from "./SettingsPage.module.css";

type SettingsView =
  | "profile"
  | "security"
  | "appearance"
  | "session";

const SETTINGS_VIEWS: readonly SegmentedTabOption<SettingsView>[] = [
  { value: "profile", label: "Profile" },
  { value: "security", label: "Privacy & Security" },
  { value: "appearance", label: "Appearance" },
  { value: "session", label: "Session" },
];

export default function SettingsPage() {
  const { notify } = useActionFeedback();
  const { logout, loggingOut, error: logoutError } = useLogout();
  const { user, updateCurrentUser } = useCurrentUser();
  const [activeView, setActiveView] = useState<SettingsView>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailsUpdating, setDetailsUpdating] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [avatarUpdating, setAvatarUpdating] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [privacyUpdating, setPrivacyUpdating] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((nextProfile) => {
        if (!cancelled) setProfile(nextProfile);
      })
      .catch((error) => {
        if (!cancelled) {
          setProfileLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load account settings.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function retryProfileLoad() {
    setLoadingProfile(true);
    setProfileLoadError(null);
    setReloadKey((key) => key + 1);
  }

  function publishProfile(nextProfile: Profile) {
    setProfile(nextProfile);
    updateCurrentUser({
      first_name: nextProfile.firstName,
      last_name: nextProfile.lastName,
      profile_photo: nextProfile.profilePhoto,
    });
    window.dispatchEvent(
      new CustomEvent<Profile>("profile-updated", { detail: nextProfile }),
    );
  }

  async function handleDetailsSave(input: UpdateProfileDetailsInput) {
    if (detailsUpdating) return;
    setDetailsUpdating(true);
    setDetailsError(null);
    try {
      const nextProfile = await updateMyProfileDetails(input);
      publishProfile(nextProfile);
      notify("Profile details updated.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update profile details.";
      setDetailsError(message);
      notify(message, "error");
    } finally {
      setDetailsUpdating(false);
    }
  }

  async function handleAvatarSave(input: UpdateProfileAvatarInput) {
    if (avatarUpdating) return;
    setAvatarUpdating(true);
    setAvatarError(null);
    try {
      const nextProfile = await updateMyProfileAvatar(input);
      publishProfile(nextProfile);
      notify("Profile photo updated.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update profile photo.";
      setAvatarError(message);
      notify(message, "error");
      throw error;
    } finally {
      setAvatarUpdating(false);
    }
  }

  async function handlePrivacyToggle() {
    if (!profile || privacyUpdating) return;
    setPrivacyUpdating(true);
    setPrivacyError(null);
    try {
      const isPrivate = await updateMyProfilePrivacy(!profile.isPrivate);
      const nextProfile = { ...profile, isPrivate };
      publishProfile(nextProfile);
      notify(`Profile is now ${isPrivate ? "private" : "public"}.`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update profile privacy.";
      setPrivacyError(message);
      notify(message, "error");
    } finally {
      setPrivacyUpdating(false);
    }
  }

  function renderProfileState(label: string) {
    if (loadingProfile) {
      return (
        <div className={styles.profileState} role="status">
          {label}
        </div>
      );
    }
    if (profileLoadError || !profile) {
      return (
        <div className={styles.profileError} role="alert">
          <span>{profileLoadError ?? "Profile settings are unavailable."}</span>
          <button type="button" onClick={retryProfileLoad}>
            Try again
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <main
      className={`${styles.settingsPage} settings-page space-shell`}
      aria-labelledby="app-page-title"
    >
      <div className={styles.container}>
        <SegmentedTabs
          value={activeView}
          options={SETTINGS_VIEWS}
          onChange={setActiveView}
          ariaLabel="Settings sections"
          idPrefix="settings"
          panelId={(value) => `settings-panel-${value}`}
          className={styles.settingsTabs}
        />

        <section
          id="settings-panel-profile"
          className={`${styles.panel} ${styles.accountSection}`}
          role="tabpanel"
          aria-labelledby="settings-tab-profile"
          hidden={activeView !== "profile"}
        >
          <SectionHeader
            title="Profile and account"
            description="Manage the information people see and your profile photo."
          />
          {renderProfileState("Loading account settings…")}
          {profile && !loadingProfile && !profileLoadError && (
            <div className={styles.accountGrid}>
              <ProfileDetailsForm
                key={`${profile.id}:${profile.updatedAt}:details`}
                profile={profile}
                saving={detailsUpdating}
                error={detailsError}
                onSave={handleDetailsSave}
              />
              <div className={styles.accountSide}>
                <ProfileAvatarForm
                  key={`${profile.id}:${profile.profilePhoto ?? ""}:avatar`}
                  profile={profile}
                  saving={avatarUpdating}
                  error={avatarError}
                  onSave={handleAvatarSave}
                />
                <ProfileAccountCard profile={profile} />
              </div>
            </div>
          )}
        </section>

        <section
          id="settings-panel-security"
          className={styles.panel}
          role="tabpanel"
          aria-labelledby="settings-tab-security"
          hidden={activeView !== "security"}
        >
          <SectionHeader
            title="Privacy & Security"
            description="Manage your profile visibility, data privacy, and account credentials."
          />
          <div className={styles.settingsTwoColGrid}>
            <div className={styles.settingsMainCol}>
              {/* Profile Visibility Card */}
              <section className={styles.card} aria-labelledby="privacy-heading">
                <div className={styles.cardHeader}>
                  <div>
                    <h3 id="privacy-heading" className={styles.cardTitle}>
                      Profile Visibility
                    </h3>
                    <p className={styles.cardDescription}>
                      Control who can view your profile and personal activity.
                    </p>
                  </div>
                  {profile && (
                    <span className={profile.isPrivate ? styles.privateBadge : styles.publicBadge}>
                      <AppIcon name={profile.isPrivate ? "lock" : "globe"} width={13} height={13} />
                      {profile.isPrivate ? "Private" : "Public"}
                    </span>
                  )}
                </div>

                <div className={styles.cardBody}>
                  {renderProfileState("Loading privacy settings…")}
                  {profile && !loadingProfile && !profileLoadError && (
                    <div className={styles.visibilityCardContent}>
                      <p className={styles.visibilityDescription}>
                        {profile.isPrivate
                          ? "Your profile is private. Protected details and posts are hidden from unauthorized visitors."
                          : "Your profile is public. Anyone on Social Network can view your posts and profile information."}
                      </p>
                      <div className={styles.visibilityActionRow}>
                        <button
                          type="button"
                          onClick={handlePrivacyToggle}
                          disabled={privacyUpdating}
                          className={profile.isPrivate ? styles.primaryButton : styles.secondaryButton}
                        >
                          {privacyUpdating
                            ? "Updating…"
                            : profile.isPrivate
                              ? "Make Profile Public"
                              : "Make Profile Private"}
                        </button>
                      </div>
                      {privacyError && (
                        <p className={styles.feedbackError} role="alert">
                          {privacyError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Change Password Card */}
              <section className={styles.card} aria-labelledby="password-heading">
                <div className={styles.cardHeader}>
                  <div>
                    <h3 id="password-heading" className={styles.cardTitle}>
                      Change Password
                    </h3>
                    <p className={styles.cardDescription}>
                      Confirm your current password before choosing a new one.
                    </p>
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <PasswordForm />
                </div>
              </section>
            </div>

            {/* Right Column: Tips & Guidelines */}
            <aside className={styles.card} aria-labelledby="security-tips-heading">
              <div className={styles.cardHeader}>
                <div>
                  <h3 id="security-tips-heading" className={styles.cardTitle}>
                    Privacy &amp; Security
                  </h3>
                  <p className={styles.cardDescription}>
                    Guidelines for your account.
                  </p>
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.tipsList}>
                  <div className={styles.tipItem}>
                    <span className={styles.tipIcon} aria-hidden="true">
                      <AppIcon name="shield" width={14} height={14} />
                    </span>
                    <div>
                      <strong>Account Visibility</strong>
                      <p>Private accounts require follow approvals before viewing content.</p>
                    </div>
                  </div>
                  <div className={styles.tipItem}>
                    <span className={styles.tipIcon} aria-hidden="true">
                      <AppIcon name="lock" width={14} height={14} />
                    </span>
                    <div>
                      <strong>Password Requirements</strong>
                      <p>Use at least 8 characters with letters, numbers, or symbols.</p>
                    </div>
                  </div>
                  <div className={styles.tipItem}>
                    <span className={styles.tipIcon} aria-hidden="true">
                      <AppIcon name="key" width={14} height={14} />
                    </span>
                    <div>
                      <strong>Credential Safety</strong>
                      <p>Never share your password or reuse it across external websites.</p>
                    </div>
                  </div>
                  <div className={styles.tipItem}>
                    <span className={styles.tipIcon} aria-hidden="true">
                      <AppIcon name="globe" width={14} height={14} />
                    </span>
                    <div>
                      <strong>Active Sessions</strong>
                      <p>Changing your password keeps your current browser signed in.</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section
          id="settings-panel-appearance"
          className={styles.panel}
          role="tabpanel"
          aria-labelledby="settings-tab-appearance"
          hidden={activeView !== "appearance"}
        >
          <SectionHeader
            title="Appearance"
            description="Choose your celestial theme and background behavior."
          />
          <AppearanceSettings />
        </section>

        <section
          id="settings-panel-session"
          className={styles.panel}
          role="tabpanel"
          aria-labelledby="settings-tab-session"
          hidden={activeView !== "session"}
        >
          <SectionHeader
            title="Session"
            description="Manage your current browser session."
          />
          <div className={styles.settingsTwoColGrid}>
            <section className={styles.card} aria-labelledby="session-heading">
              <div className={styles.cardHeader}>
                <div>
                  <h3 id="session-heading" className={styles.cardTitle}>
                    Active Session
                  </h3>
                  <p className={styles.cardDescription}>
                    Your current authenticated browser session.
                  </p>
                </div>
                <span className={styles.activeBadge}>
                  <span className={styles.activeDot} />
                  Active now
                </span>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.sessionCardContent}>
                  <div className={styles.sessionUserRow}>
                    <UserAvatar
                      src={user?.profile_photo}
                      name={`${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || user?.username || "User"}
                      size={42}
                    />
                    <div className={styles.sessionUserMeta}>
                      <strong>{user?.first_name} {user?.last_name}</strong>
                      <span>@{user?.username}</span>
                    </div>
                  </div>

                  <div className={styles.sessionDetails}>
                    <div className={styles.sessionDetailItem}>
                      <span className={styles.sessionDetailLabel}>Device</span>
                      <span className={styles.sessionDetailValue}>This Web Browser</span>
                    </div>
                    <div className={styles.sessionDetailItem}>
                      <span className={styles.sessionDetailLabel}>Status</span>
                      <span className={styles.sessionDetailValue}>Connected</span>
                    </div>
                  </div>

                  <div className={styles.sessionDivider} />

                  <div className={styles.signOutArea}>
                    <div className={styles.signOutInfo}>
                      <h4 className={styles.signOutTitle}>Sign out</h4>
                      <p className={styles.signOutDescription}>
                        End this browser session. Your profile, posts, and data remain safe.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.signOutButton}
                      disabled={loggingOut}
                      onClick={logout}
                    >
                      <AppIcon name="logOut" width={14} height={14} />
                      {loggingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                  {logoutError && (
                    <p className={styles.feedbackError} role="alert">
                      {logoutError}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <aside className={styles.card} aria-labelledby="session-security-heading">
              <div className={styles.cardHeader}>
                <div>
                  <h3 id="session-security-heading" className={styles.cardTitle}>
                    Session Info
                  </h3>
                  <p className={styles.cardDescription}>
                    Authentication security.
                  </p>
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.tipsList}>
                  <div className={styles.tipItem}>
                    <span className={styles.tipIcon} aria-hidden="true">
                      <AppIcon name="key" width={14} height={14} />
                    </span>
                    <div>
                      <strong>Secure Cookie</strong>
                      <p>Session cookies are protected with HTTP-only and strict flags.</p>
                    </div>
                  </div>
                  <div className={styles.tipItem}>
                    <span className={styles.tipIcon} aria-hidden="true">
                      <AppIcon name="zap" width={14} height={14} />
                    </span>
                    <div>
                      <strong>Real-time Sync</strong>
                      <p>Active connections automatically close when you sign out.</p>
                    </div>
                  </div>
                  <div className={styles.tipItem}>
                    <span className={styles.tipIcon} aria-hidden="true">
                      <AppIcon name="logOut" width={14} height={14} />
                    </span>
                    <div>
                      <strong>Instant Revocation</strong>
                      <p>Signing out immediately destroys your session on the server.</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className={styles.accountHeader}>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}
