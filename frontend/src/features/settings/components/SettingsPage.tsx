"use client";

import { useEffect, useState, type CSSProperties } from "react";
import SegmentedTabs, {
  type SegmentedTabOption,
} from "@/components/SegmentedTabs";
import { usePlanetPreference } from "@/components/space/PlanetPreferenceProvider";
import { useActionFeedback } from "@/components/feedback/ActionFeedbackProvider";
import { useLogout } from "@/components/layout/useLogout";
import {
  SELECTABLE_PLANETS,
  type PlanetTheme,
} from "@/components/space/modelsRegistry";
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
import styles from "./SettingsPage.module.css";

type OptionStyle = CSSProperties & {
  "--option-accent": string;
  "--option-accent-hover": string;
  "--option-glow": string;
};

type SettingsView = "profile" | "privacy" | "appearance" | "session";

const SETTINGS_VIEWS: readonly SegmentedTabOption<SettingsView>[] = [
  { value: "profile", label: "Profile" },
  { value: "privacy", label: "Privacy" },
  { value: "appearance", label: "Appearance" },
  { value: "session", label: "Session" },
];

function createOptionStyle(theme: PlanetTheme): OptionStyle {
  return {
    "--option-accent": theme.accent,
    "--option-accent-hover": theme.accentHover,
    "--option-glow": theme.glow,
  };
}

export default function SettingsPage() {
  const {
    selectedPlanetId,
    selectedPlanet,
    planetModelEnabled,
    selectPlanet,
    setPlanetModelEnabled,
  } = usePlanetPreference();
  const { notify } = useActionFeedback();
  const { logout, loggingOut, error: logoutError } = useLogout();
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
            error instanceof Error ? error.message : "Unable to load account settings.",
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
    window.dispatchEvent(
      new CustomEvent<Profile>("profile-updated", { detail: nextProfile }),
    );
  }

  async function handleDetailsSave(input: UpdateProfileDetailsInput) {
    setDetailsUpdating(true);
    setDetailsError(null);
    try {
      const nextProfile = await updateMyProfileDetails(input);
      publishProfile(nextProfile);
      notify("Profile details updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update profile details.";
      setDetailsError(message);
      notify(message, "error");
    } finally {
      setDetailsUpdating(false);
    }
  }

  async function handleAvatarSave(input: UpdateProfileAvatarInput) {
    setAvatarUpdating(true);
    setAvatarError(null);
    try {
      const nextProfile = await updateMyProfileAvatar(input);
      publishProfile(nextProfile);
      notify("Profile photo updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update profile photo.";
      setAvatarError(message);
      notify(message, "error");
      throw error;
    } finally {
      setAvatarUpdating(false);
    }
  }

  async function handlePrivacyToggle() {
    if (!profile) return;
    setPrivacyUpdating(true);
    setPrivacyError(null);
    try {
      const isPrivate = await updateMyProfilePrivacy(!profile.isPrivate);
      const nextProfile = { ...profile, isPrivate };
      publishProfile(nextProfile);
      notify(`Profile is now ${isPrivate ? "private" : "public"}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update profile privacy.";
      setPrivacyError(message);
      notify(message, "error");
    } finally {
      setPrivacyUpdating(false);
    }
  }

  return (
    <main className="settings-page space-shell" aria-labelledby="app-page-title">
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
          <div className={styles.accountHeader}>
            <div>
              <h2 id="account-heading">Profile and account</h2>
              <p>Manage the information people see and your profile photo.</p>
            </div>
          </div>

          {loadingProfile && (
            <div className={styles.profileState} role="status">
              Loading account settings…
            </div>
          )}
          {!loadingProfile && profileLoadError && (
            <div className={styles.profileError} role="alert">
              <span>{profileLoadError}</span>
              <button type="button" onClick={retryProfileLoad}>
                Try again
              </button>
            </div>
          )}
          {profile && !loadingProfile && (
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
          <div className={styles.accountHeader}>
            <div>
              <h2>Privacy</h2>
              <p>Control who can view your profile and personal activity.</p>
            </div>
          </div>

          {loadingProfile && (
            <div className={styles.profileState} role="status">
              Loading privacy settings…
            </div>
          )}
          {!loadingProfile && profileLoadError && (
            <div className={styles.profileError} role="alert">
              <span>{profileLoadError}</span>
              <button type="button" onClick={retryProfileLoad}>
                Try again
              </button>
            </div>
          )}
          {profile && !loadingProfile && (
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
          id="settings-panel-appearance"
          className={`${styles.panel} ${styles.section}`}
          role="tabpanel"
          aria-labelledby="settings-tab-appearance"
          hidden={activeView !== "appearance"}
        >
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="planet-heading" className={styles.sectionTitle}>
                Planet
              </h2>
              <p id="planet-hint" className={styles.sectionHint}>
                Choose the celestial theme used across your space, with or
                without its 3D model.
              </p>
            </div>
            <span className={styles.currentPlanet} aria-live="polite">
              {selectedPlanet.label} theme · 3D{" "}
              {planetModelEnabled ? "on" : "off"}
            </span>
          </div>

          <label
            className={styles.modelToggle}
            data-enabled={planetModelEnabled}
          >
            <span className={styles.toggleText}>
              <strong>Show 3D model</strong>
              <span id="model-toggle-hint">
                {planetModelEnabled
                  ? `Display the ${selectedPlanet.label} model.`
                  : `Keep the ${selectedPlanet.label} theme without WebGL rendering.`}
              </span>
            </span>
            <input
              className={styles.modelCheckbox}
              type="checkbox"
              checked={planetModelEnabled}
              aria-describedby="model-toggle-hint"
              onChange={(event) => setPlanetModelEnabled(event.target.checked)}
            />
          </label>

          <fieldset
            className={styles.planetFieldset}
            aria-describedby="planet-hint"
          >
            <legend className={styles.srOnly}>Planet appearance</legend>
            <div className={styles.planetGrid}>
              {SELECTABLE_PLANETS.map((planet) => {
                const selected = planet.id === selectedPlanetId;
                return (
                  <label
                    key={planet.id}
                    className={styles.planetOption}
                    style={createOptionStyle(planet.theme)}
                  >
                    <input
                      className={styles.planetRadio}
                      type="radio"
                      name="active-planet"
                      value={planet.id}
                      checked={selected}
                      onChange={() => selectPlanet(planet.id)}
                    />
                    <span className={styles.optionCard}>
                      <span className={styles.planetOrb} aria-hidden="true" />
                      <span className={styles.optionText}>
                        <strong>{planet.label}</strong>
                        <span>{selected ? "Selected" : "Select"}</span>
                      </span>
                      <span className={styles.checkmark} aria-hidden="true">
                        ✓
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </section>

        <section
          id="settings-panel-session"
          className={`${styles.panel} ${styles.section} ${styles.sessionSection}`}
          role="tabpanel"
          aria-labelledby="settings-tab-session"
          hidden={activeView !== "session"}
        >
          <div>
            <h2 id="session-heading" className={styles.sectionTitle}>
              Session
            </h2>
            <p className={styles.sectionHint}>
              Sign out of this browser. Your profile and account data will stay intact.
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
        </section>
      </div>
    </main>
  );
}
