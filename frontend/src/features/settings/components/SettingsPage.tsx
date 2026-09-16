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
import ProfilePrivacy from "@/features/profile/components/ProfilePrivacy";
import type { Profile } from "@/features/profile/types/profile";
import AppearanceSettings from "./AppearanceSettings";
import PasswordForm from "./PasswordForm";
import styles from "./SettingsPage.module.css";

type SettingsView =
  | "profile"
  | "privacy"
  | "security"
  | "appearance"
  | "session";

const SETTINGS_VIEWS: readonly SegmentedTabOption<SettingsView>[] = [
  { value: "profile", label: "Profile" },
  { value: "privacy", label: "Privacy" },
  { value: "security", label: "Security" },
  { value: "appearance", label: "Appearance" },
  { value: "session", label: "Session" },
];

export default function SettingsPage() {
  const { notify } = useActionFeedback();
  const { logout, loggingOut, error: logoutError } = useLogout();
  const { updateCurrentUser } = useCurrentUser();
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
          id="settings-panel-privacy"
          className={`${styles.panel} ${styles.accountSection}`}
          role="tabpanel"
          aria-labelledby="settings-tab-privacy"
          hidden={activeView !== "privacy"}
        >
          <SectionHeader
            title="Privacy"
            description="Control who can view your profile and personal activity."
          />
          {renderProfileState("Loading privacy settings…")}
          {profile && !loadingProfile && !profileLoadError && (
            <div className={styles.privacyContent}>
              <ProfilePrivacy
                isPrivate={profile.isPrivate}
                updating={privacyUpdating}
                error={privacyError}
                onTogglePrivacy={handlePrivacyToggle}
              />
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
            title="Security"
            description="Update the password used to access your account."
          />
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
            <PasswordForm />
          </section>
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
          <div className={`${styles.card} ${styles.sessionSection}`}>
            <div>
              <h3 className={styles.cardTitle}>Sign out</h3>
              <p className={styles.cardDescription}>
                Your profile and account data will stay intact.
              </p>
            </div>
            <div className={styles.sessionAction}>
              <button
                type="button"
                className={styles.signOutButton}
                disabled={loggingOut}
                onClick={logout}
              >
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
              {logoutError && <p role="alert">{logoutError}</p>}
            </div>
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
