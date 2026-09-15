"use client";

import { FormEvent, useMemo, useState } from "react";
import { parseDate } from "@/lib/utils";
import type { UpdateProfileDetailsInput } from "../api/profiles";
import type { Profile } from "../types/profile";
import styles from "./Profile.module.css";

interface ProfileDetailsFormProps {
  profile: Profile;
  saving: boolean;
  error?: string | null;
  onSave: (input: UpdateProfileDetailsInput) => Promise<void>;
}

// <input type="date"> only accepts an exact "YYYY-MM-DD" value - anything
// else (e.g. a date with a time component from older data) is silently
// rendered as empty. That blank field would then get resubmitted as-is,
// which the backend rejects as an invalid format, blocking the whole save
// even though the profile already has a birth date. Reformatting through
// parseDate (UTC, so the calendar day never shifts) keeps the field
// pre-filled and normalizes it back to a format the backend accepts.
function toDateInputValue(value: string): string {
  const date = parseDate(value);
  if (!date) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getFormState(profile: Profile): UpdateProfileDetailsInput {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    nickname: profile.nickname,
    aboutMe: profile.aboutMe,
    dateOfBirth: toDateInputValue(profile.dateOfBirth),
  };
}

function getTodayInputValue(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

export default function ProfileDetailsForm({
  profile,
  saving,
  error,
  onSave,
}: ProfileDetailsFormProps) {
  const [formState, setFormState] = useState(() => getFormState(profile));
  const [localError, setLocalError] = useState<string | null>(null);

  const hasChanges = useMemo(() => {
    const original = getFormState(profile);
    return (
      formState.firstName !== original.firstName ||
      formState.lastName !== original.lastName ||
      formState.nickname !== original.nickname ||
      formState.aboutMe !== original.aboutMe ||
      formState.dateOfBirth !== original.dateOfBirth
    );
  }, [formState, profile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextInput = {
      firstName: formState.firstName.trim(),
      lastName: formState.lastName.trim(),
      nickname: formState.nickname.trim(),
      aboutMe: formState.aboutMe.trim(),
      dateOfBirth: formState.dateOfBirth.trim(),
    };

    if (!nextInput.firstName || !nextInput.lastName) {
      setLocalError("First name and last name are required.");
      return;
    }

    setLocalError(null);
    await onSave(nextInput);
  }

  function updateField(
    field: keyof UpdateProfileDetailsInput,
    value: string,
  ) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setFormState(getFormState(profile));
    setLocalError(null);
  }

  const shownError = localError ?? error;

  return (
    <section
      className={`${styles.card} ${styles.detailsFormCard}`}
      aria-labelledby="profile-details-heading"
    >
      <h3 id="profile-details-heading" className={styles.cardTitle}>
        <span>Edit Profile Details</span>
      </h3>

      <form className={styles.profileForm} onSubmit={handleSubmit}>
        <div className={styles.profileFormGrid}>
          <div className={styles.profileFormField}>
            <label
              className={styles.profileFormLabel}
              htmlFor="profile-first-name"
            >
              First Name
            </label>
            <input
              id="profile-first-name"
              type="text"
              value={formState.firstName}
              onChange={(event) => updateField("firstName", event.target.value)}
              className={styles.profileFormControl}
              maxLength={500}
              required
              disabled={saving}
            />
          </div>

          <div className={styles.profileFormField}>
            <label
              className={styles.profileFormLabel}
              htmlFor="profile-last-name"
            >
              Last Name
            </label>
            <input
              id="profile-last-name"
              type="text"
              value={formState.lastName}
              onChange={(event) => updateField("lastName", event.target.value)}
              className={styles.profileFormControl}
              maxLength={500}
              required
              disabled={saving}
            />
          </div>

          <div className={styles.profileFormField}>
            <label
              className={styles.profileFormLabel}
              htmlFor="profile-nickname"
            >
              Nickname
            </label>
            <input
              id="profile-nickname"
              type="text"
              value={formState.nickname}
              onChange={(event) => updateField("nickname", event.target.value)}
              className={styles.profileFormControl}
              maxLength={50}
              disabled={saving}
            />
          </div>

          <div className={styles.profileFormField}>
            <label
              className={styles.profileFormLabel}
              htmlFor="profile-date-of-birth"
            >
              Date of Birth
            </label>
            <input
              id="profile-date-of-birth"
              type="date"
              value={formState.dateOfBirth}
              onChange={(event) =>
                updateField("dateOfBirth", event.target.value)
              }
              className={styles.profileFormControl}
              max={getTodayInputValue()}
              disabled={saving}
            />
          </div>

          <div
            className={`${styles.profileFormField} ${styles.profileFormFieldFull}`}
          >
            <label
              className={styles.profileFormLabel}
              htmlFor="profile-about-me"
            >
              About Me
            </label>
            <textarea
              id="profile-about-me"
              value={formState.aboutMe}
              onChange={(event) => updateField("aboutMe", event.target.value)}
              className={`${styles.profileFormControl} ${styles.profileFormTextarea}`}
              maxLength={500}
              disabled={saving}
            />
            <span className={styles.profileFormMeta}>
              {formState.aboutMe.length}/500
            </span>
          </div>
        </div>

        {shownError && (
          <p className="form-error" role="alert">
            {shownError}
          </p>
        )}

        <div className={styles.profileFormActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={resetForm}
            disabled={saving || !hasChanges}
          >
            Reset
          </button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={saving || !hasChanges}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
