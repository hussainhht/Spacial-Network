"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import { getTodayInputValue, parseDate } from "@/lib/utils";
import type { UpdateProfileDetailsInput } from "../api/profiles";
import type { BirthdayVisibility, Profile } from "../types/profile";
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

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const BIRTHDAY_VISIBILITY_OPTIONS: {
  value: BirthdayVisibility;
  label: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    value: "public",
    label: "Public",
    hint: "Anyone viewing your profile can see it",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    ),
  },
  {
    value: "private",
    label: "Only me",
    hint: "Only you can see it",
    icon: (
      <svg {...iconProps}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    ),
  },
];

function getFormState(profile: Profile): UpdateProfileDetailsInput {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    nickname: profile.nickname,
    aboutMe: profile.aboutMe,
    dateOfBirth: toDateInputValue(profile.dateOfBirth),
    birthdayVisibility: profile.birthdayVisibility,
  };
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
      formState.dateOfBirth !== original.dateOfBirth ||
      formState.birthdayVisibility !== original.birthdayVisibility
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
      birthdayVisibility: formState.birthdayVisibility,
    };

    if (!nextInput.firstName || !nextInput.lastName) {
      setLocalError("First name and last name are required.");
      return;
    }

    setLocalError(null);
    await onSave(nextInput);
  }

  function updateField(
    field: Exclude<keyof UpdateProfileDetailsInput, "birthdayVisibility">,
    value: string,
  ) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateBirthdayVisibility(value: BirthdayVisibility) {
    setFormState((current) => ({ ...current, birthdayVisibility: value }));
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
            <span
              className={styles.profileFormLabel}
              id="profile-birthday-visibility-label"
            >
              Birthday Visibility
            </span>
            <div
              className={styles.visibilityGroup}
              role="radiogroup"
              aria-labelledby="profile-birthday-visibility-label"
            >
              {BIRTHDAY_VISIBILITY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={styles.visibilityOption}
                  data-checked={formState.birthdayVisibility === option.value}
                >
                  <input
                    type="radio"
                    name="birthday-visibility"
                    value={option.value}
                    checked={formState.birthdayVisibility === option.value}
                    onChange={() => updateBirthdayVisibility(option.value)}
                    className={styles.visibilityInput}
                    disabled={saving}
                  />
                  {option.icon}
                  <span className={styles.visibilityText}>
                    <span className={styles.visibilityTitle}>
                      {option.label}
                    </span>
                    <span className={styles.visibilityHint}>{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
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
