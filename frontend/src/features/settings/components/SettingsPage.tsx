"use client";

import { useEffect, useState } from "react";
import AppIcon, { type AppIconName } from "@/components/layout/AppIcon";
import UserAvatar from "@/components/UserAvatar";
import { useCurrentUser } from "@/features/auth/context/CurrentUserContext";
import {
  getMyProfile,
  updateMyProfileAvatar,
  updateMyProfileDetails,
  updateMyProfilePrivacy,
  type UpdateProfileAvatarInput,
  type UpdateProfileDetailsInput,
} from "@/features/profile/api/profiles";
import ProfileAvatarForm from "@/features/profile/components/ProfileAvatarForm";
import ProfileDetailsForm from "@/features/profile/components/ProfileDetailsForm";
import type { Profile } from "@/features/profile/types/profile";
import AppearanceSettings from "./AppearanceSettings";
import PasswordForm from "./PasswordForm";
import styles from "./SettingsPage.module.css";

type SettingsSection = "profile" | "privacy" | "security" | "appearance";

interface SectionDefinition {
  id: SettingsSection;
  label: string;
  description: string;
  icon: AppIconName;
}

const SECTIONS: readonly SectionDefinition[] = [
  { id: "profile", label: "Profile", description: "Personal details and photo", icon: "user" },
  { id: "privacy", label: "Privacy", description: "Profile visibility", icon: "globe" },
  { id: "security", label: "Security", description: "Password and access", icon: "lock" },
  { id: "appearance", label: "Appearance & 3D", description: "Planet theme and rendering", icon: "orbit" },
];

interface Feedback {
  kind: "success" | "error";
  message: string;
}

export default function SettingsPage() {
  const { updateCurrentUser } = useCurrentUser();
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getMyProfile()
      .then((loadedProfile) => {
        if (!cancelled) setProfile(loadedProfile);
      })
      .catch((error) => {
        if (!cancelled) {
          setProfileLoadError(
            error instanceof Error ? error.message : "Could not load settings.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function selectSection(section: SettingsSection) {
    setActiveSection(section);
    setFeedback(null);
  }

  function retryProfileLoad() {
    setProfileLoading(true);
    setProfileLoadError(null);
    setReloadKey((current) => current + 1);
  }

  async function handleUpdateDetails(input: UpdateProfileDetailsInput) {
    if (detailsSaving) return;
    setDetailsSaving(true);
    setDetailsError(null);
    setFeedback(null);
    try {
      const updated = await updateMyProfileDetails(input);
      setProfile(updated);
      updateCurrentUser({ first_name: updated.firstName, last_name: updated.lastName });
      setFeedback({ kind: "success", message: "Profile details saved." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save profile details.";
      setDetailsError(message);
      setFeedback({ kind: "error", message });
    } finally {
      setDetailsSaving(false);
    }
  }

  async function handleUpdateAvatar(input: UpdateProfileAvatarInput) {
    if (avatarSaving) return;
    setAvatarSaving(true);
    setAvatarError(null);
    setFeedback(null);
    try {
      const updated = await updateMyProfileAvatar(input);
      setProfile(updated);
      updateCurrentUser({ profile_photo: updated.profilePhoto });
      setFeedback({ kind: "success", message: "Profile photo saved." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save profile photo.";
      setAvatarError(message);
      setFeedback({ kind: "error", message });
      throw error;
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handlePrivacyChange(isPrivate: boolean) {
    if (!profile || privacySaving || profile.isPrivate === isPrivate) return;
    setPrivacySaving(true);
    setFeedback(null);
    try {
      const updatedPrivacy = await updateMyProfilePrivacy(isPrivate);
      setProfile((current) => current ? { ...current, isPrivate: updatedPrivacy } : current);
      setFeedback({
        kind: "success",
        message: `Your profile is now ${updatedPrivacy ? "private" : "public"}.`,
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not update profile privacy.",
      });
    } finally {
      setPrivacySaving(false);
    }
  }

  const activeDefinition = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0];

  return (
    <main className={`${styles.settingsPage} settings-page space-shell`} aria-labelledby="app-page-title">
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <p className={styles.eyebrow}>Account settings</p>
          <h2 className={styles.pageTitle}>Make your space feel like yours</h2>
          <p className={styles.pageDescription}>
            Manage your identity, visibility, security, and celestial theme in one place.
          </p>
        </header>

        <div className={styles.mobileSectionPicker}>
          <label htmlFor="settings-section">Settings section</label>
          <select
            id="settings-section"
            value={activeSection}
            onChange={(event) => selectSection(event.target.value as SettingsSection)}
          >
            {SECTIONS.map((section) => (
              <option key={section.id} value={section.id}>{section.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.settingsLayout}>
          <nav className={styles.sectionNav} aria-label="Account settings sections">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={styles.navItem}
                data-active={activeSection === section.id}
                aria-current={activeSection === section.id ? "page" : undefined}
                aria-controls="settings-active-panel"
                onClick={() => selectSection(section.id)}
              >
                <AppIcon name={section.icon} width={18} height={18} />
                <span>
                  <strong>{section.label}</strong>
                  <small>{section.description}</small>
                </span>
              </button>
            ))}
          </nav>

          <section id="settings-active-panel" className={styles.contentPanel} aria-labelledby="settings-section-heading">
            <header className={styles.contentHeader}>
              <div className={styles.contentIcon} aria-hidden="true">
                <AppIcon name={activeDefinition.icon} />
              </div>
              <div>
                <h2 id="settings-section-heading">{activeDefinition.label}</h2>
                <p>{activeDefinition.description}</p>
              </div>
            </header>

            {feedback && activeSection !== "security" && (
              <p
                className={feedback.kind === "success" ? styles.feedbackSuccess : styles.feedbackError}
                role={feedback.kind === "error" ? "alert" : "status"}
              >
                {feedback.message}
              </p>
            )}

            {activeSection === "profile" && (
              <ProfileSection
                profile={profile}
                loading={profileLoading}
                loadError={profileLoadError}
                detailsSaving={detailsSaving}
                avatarSaving={avatarSaving}
                detailsError={detailsError}
                avatarError={avatarError}
                onRetry={retryProfileLoad}
                onUpdateDetails={handleUpdateDetails}
                onUpdateAvatar={handleUpdateAvatar}
              />
            )}

            {activeSection === "privacy" && (
              <PrivacySection
                profile={profile}
                loading={profileLoading}
                loadError={profileLoadError}
                saving={privacySaving}
                onRetry={retryProfileLoad}
                onChange={handlePrivacyChange}
              />
            )}

            {activeSection === "security" && (
              <section className={styles.card} aria-labelledby="password-heading">
                <div className={styles.cardHeader}>
                  <div>
                    <h3 id="password-heading" className={styles.cardTitle}>Change Password</h3>
                    <p className={styles.cardDescription}>
                      Confirm your current password before choosing a new one.
                    </p>
                  </div>
                </div>
                <PasswordForm />
              </section>
            )}

            {activeSection === "appearance" && <AppearanceSettings />}
          </section>
        </div>
      </div>
    </main>
  );
}

function ProfileSection({
  profile,
  loading,
  loadError,
  detailsSaving,
  avatarSaving,
  detailsError,
  avatarError,
  onRetry,
  onUpdateDetails,
  onUpdateAvatar,
}: {
  profile: Profile | null;
  loading: boolean;
  loadError: string | null;
  detailsSaving: boolean;
  avatarSaving: boolean;
  detailsError: string | null;
  avatarError: string | null;
  onRetry: () => void;
  onUpdateDetails: (input: UpdateProfileDetailsInput) => Promise<void>;
  onUpdateAvatar: (input: UpdateProfileAvatarInput) => Promise<void>;
}) {
  if (loading) return <LoadingState label="Loading your profile…" />;
  if (loadError || !profile) {
    return <LoadErrorState message={loadError ?? "Profile unavailable."} onRetry={onRetry} />;
  }

  return (
    <div className={styles.sectionStack}>
      <section className={styles.accountSummary} aria-label="Current account">
        <UserAvatar
          src={profile.profilePhoto}
          firstName={profile.firstName}
          lastName={profile.lastName}
          username={profile.username}
          size={64}
          alt=""
        />
        <div className={styles.accountIdentity}>
          <strong>{profile.firstName} {profile.lastName}</strong>
          <span>@{profile.username}</span>
          <span>{profile.email}</span>
        </div>
      </section>

      <ProfileAvatarForm profile={profile} saving={avatarSaving} error={avatarError} onSave={onUpdateAvatar} />
      <ProfileDetailsForm profile={profile} saving={detailsSaving} error={detailsError} onSave={onUpdateDetails} />
    </div>
  );
}

function PrivacySection({
  profile,
  loading,
  loadError,
  saving,
  onRetry,
  onChange,
}: {
  profile: Profile | null;
  loading: boolean;
  loadError: string | null;
  saving: boolean;
  onRetry: () => void;
  onChange: (isPrivate: boolean) => Promise<void>;
}) {
  if (loading) return <LoadingState label="Loading privacy settings…" />;
  if (loadError || !profile) {
    return <LoadErrorState message={loadError ?? "Privacy settings unavailable."} onRetry={onRetry} />;
  }

  return (
    <section className={styles.card} aria-labelledby="visibility-heading">
      <div className={styles.cardHeader}>
        <div>
          <h3 id="visibility-heading" className={styles.cardTitle}>Profile Visibility</h3>
          <p className={styles.cardDescription}>
            Choose who can see your protected profile information and posts.
          </p>
        </div>
        <span className={styles.statusPill} aria-live="polite">
          {saving ? "Saving…" : profile.isPrivate ? "Private" : "Public"}
        </span>
      </div>

      <fieldset className={styles.privacyChoices} disabled={saving}>
        <legend className={styles.srOnly}>Profile visibility</legend>
        <label className={styles.privacyChoice} data-selected={!profile.isPrivate}>
          <input
            type="radio"
            name="profile-visibility"
            checked={!profile.isPrivate}
            onChange={() => void onChange(false)}
          />
          <span className={styles.choiceIcon} aria-hidden="true"><AppIcon name="globe" /></span>
          <span>
            <strong>Public</strong>
            <small>People can view your profile according to the current public-profile rules.</small>
          </span>
          <span className={styles.selectedLabel}>{!profile.isPrivate ? "Selected" : ""}</span>
        </label>

        <label className={styles.privacyChoice} data-selected={profile.isPrivate}>
          <input
            type="radio"
            name="profile-visibility"
            checked={profile.isPrivate}
            onChange={() => void onChange(true)}
          />
          <span className={styles.choiceIcon} aria-hidden="true"><AppIcon name="lock" /></span>
          <span>
            <strong>Private</strong>
            <small>Protected details and posts are visible only under the existing follower rules.</small>
          </span>
          <span className={styles.selectedLabel}>{profile.isPrivate ? "Selected" : ""}</span>
        </label>
      </fieldset>

      <p className={styles.privacyNote}>
        Existing followers stay connected. New followers use the current follow-request behavior.
      </p>
    </section>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className={styles.stateCard} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function LoadErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.stateCard} role="alert">
      <span>{message}</span>
      <button type="button" className={styles.secondaryButton} onClick={onRetry}>Try again</button>
    </div>
  );
}
