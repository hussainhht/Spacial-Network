"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getBackendBaseUrl } from "@/lib/api";
import { getInitials } from "@/lib/utils";
import type { UpdateProfileAvatarInput } from "../api/profiles";
import type { Profile } from "../types/profile";
import styles from "./Profile.module.css";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
]);

interface ProfileAvatarFormProps {
  profile: Profile;
  saving: boolean;
  error?: string | null;
  onSave: (input: UpdateProfileAvatarInput) => Promise<void>;
}

function getFullPhotoUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBackendBaseUrl()}${cleanPath}`;
}

export default function ProfileAvatarForm({
  profile,
  saving,
  error,
  onSave,
}: ProfileAvatarFormProps) {
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const previewUrl = useMemo(
    () => (profilePhoto ? URL.createObjectURL(profilePhoto) : null),
    [profilePhoto],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const currentPhotoUrl =
    profile.profilePhoto && !removePhoto
      ? getFullPhotoUrl(profile.profilePhoto)
      : null;
  const displayedPhoto = previewUrl ?? currentPhotoUrl;
  const initials = getInitials(
    profile.firstName,
    profile.lastName,
    profile.username,
  );
  const hasChanges = Boolean(profilePhoto) || removePhoto;
  const shownError = localError ?? error;

  function handlePhotoChange(file: File | null) {
    setSaved(false);
    setLocalError(null);

    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setProfilePhoto(null);
      setLocalError("Use a JPEG, PNG, or GIF image.");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setProfilePhoto(null);
      setLocalError("Profile photo must be 5 MiB or smaller.");
      return;
    }

    setProfilePhoto(file);
    setRemovePhoto(false);
  }

  function handleRemovePhoto() {
    setProfilePhoto(null);
    setRemovePhoto(true);
    setSaved(false);
    setLocalError(null);
  }

  function resetForm() {
    setProfilePhoto(null);
    setRemovePhoto(false);
    setSaved(false);
    setLocalError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !hasChanges) return;

    setSaved(false);
    setLocalError(null);
    try {
      await onSave({ profilePhoto, removePhoto });
      setProfilePhoto(null);
      setRemovePhoto(false);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }

  return (
    <section
      className={`${styles.card} ${styles.avatarFormCard}`}
      aria-labelledby="profile-avatar-heading"
    >
      <h3 id="profile-avatar-heading" className={styles.cardTitle}>
        <span>Profile Photo</span>
      </h3>

      <form className={styles.profileForm} onSubmit={handleSubmit}>
        <div className={styles.avatarFormBody}>
          <div className={styles.avatarPreview}>
            {displayedPhoto ? (
              // Blob previews cannot be optimized by next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayedPhoto}
                alt=""
                className={styles.avatarPreviewImage}
              />
            ) : (
              <span className={styles.avatarPreviewFallback} aria-hidden="true">
                {initials}
              </span>
            )}
          </div>

          <div className={styles.avatarFormControls}>
            <div className={styles.avatarButtonRow}>
              <label
                className={styles.btnSecondary}
                htmlFor="profile-photo-upload"
              >
                Choose Photo
              </label>
              <input
                id="profile-photo-upload"
                type="file"
                accept="image/jpeg,image/png,image/gif"
                className={styles.fileInput}
                disabled={saving}
                onChange={(event) => {
                  handlePhotoChange(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />

              {displayedPhoto && (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={saving}
                  onClick={handleRemovePhoto}
                >
                  Remove Photo
                </button>
              )}
            </div>

            <p className={styles.profileFormMeta}>
              JPEG, PNG, or GIF. Maximum 5 MiB.
            </p>
          </div>
        </div>

        {shownError && (
          <p className="form-error" role="alert">
            {shownError}
          </p>
        )}

        {saved && !shownError && (
          <p className={styles.avatarFormSuccess} role="status">
            Profile photo updated.
          </p>
        )}

        <div className={styles.profileFormActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={saving || !hasChanges}
            onClick={resetForm}
          >
            Reset
          </button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={saving || !hasChanges}
          >
            {saving ? "Saving..." : "Save Photo"}
          </button>
        </div>
      </form>
    </section>
  );
}
