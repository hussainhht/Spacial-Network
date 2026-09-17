"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import { ApiError } from "@/lib/api/errors";
import { getMinDateOfBirthInputValue, getTodayInputValue } from "@/lib/utils";
import { register } from "../api/register";
import RegisterProgress, { type RegisterStep } from "./RegisterProgress";
import styles from "./RegisterForm.module.css";

const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;
const NICKNAME_MAX = 50;
const ABOUT_ME_MAX = 500;
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/gif"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nickname: string;
  aboutMe: string;
}

const INITIAL_STATE: FormState = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "male",
  nickname: "",
  aboutMe: "",
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

function validateAccountStep(state: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const username = state.username.trim();
  if (!username) errors.username = "Username is required.";
  else if (username.length < USERNAME_MIN || username.length > USERNAME_MAX)
    errors.username = `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters.`;

  const email = state.email.trim();
  if (!email) errors.email = "Email is required.";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";

  if (!state.password) errors.password = "Password is required.";
  else if (state.password.length < PASSWORD_MIN || state.password.length > PASSWORD_MAX)
    errors.password = `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`;

  if (state.confirmPassword !== state.password)
    errors.confirmPassword = "Passwords do not match.";

  return errors;
}

function validatePersonalStep(state: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!state.firstName.trim()) errors.firstName = "First name is required.";
  if (!state.lastName.trim()) errors.lastName = "Last name is required.";

  if (!state.dateOfBirth) {
    errors.dateOfBirth = "Date of birth is required.";
  } else if (state.dateOfBirth > getTodayInputValue()) {
    errors.dateOfBirth = "Date of birth cannot be in the future.";
  } else if (state.dateOfBirth < getMinDateOfBirthInputValue()) {
    errors.dateOfBirth = "Enter a valid date of birth.";
  }

  return errors;
}

// The backend returns plain English messages with no structured field/error
// codes, so route the wizard back to the right step by keyword.
function resolveErrorStep(
  message: string,
  fallbackStep: RegisterStep,
): { step: RegisterStep; field?: keyof FormState } {
  const lower = message.toLowerCase();
  if (lower.includes("username")) return { step: "account", field: "username" };
  if (lower.includes("email")) return { step: "account", field: "email" };
  if (lower.includes("password")) return { step: "account", field: "password" };
  if (lower.includes("date of birth"))
    return { step: "personal", field: "dateOfBirth" };
  if (lower.includes("first name")) return { step: "personal", field: "firstName" };
  if (lower.includes("last name")) return { step: "personal", field: "lastName" };
  if (lower.includes("gender")) return { step: "personal", field: "gender" };
  if (lower.includes("nickname")) return { step: "profile", field: "nickname" };
  if (lower.includes("about me")) return { step: "profile", field: "aboutMe" };
  if (lower.includes("photo") || lower.includes("avatar")) return { step: "profile" };
  return { step: fallbackStep };
}

function PasswordField({
  id,
  label,
  value,
  error,
  autoComplete,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  autoComplete?: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.passwordControl}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={styles.control}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className={styles.visibilityButton}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {error && (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState<RegisterStep>("account");
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const previewUrl = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : null),
    [avatarFile],
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleAvatarChange(file: File | null) {
    setAvatarError(null);
    if (!file) {
      setAvatarFile(null);
      return;
    }
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setAvatarError("Use a JPEG, PNG, or GIF image.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError("Profile photo must be 5 MiB or smaller.");
      return;
    }
    setAvatarFile(file);
  }

  function goToPreviousStep() {
    setFormError(null);
    if (step === "personal") setStep("account");
    else if (step === "profile") setStep("personal");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (step === "account") {
      const errors = validateAccountStep(form);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;
      setStep("personal");
      return;
    }

    if (step === "personal") {
      const errors = validatePersonalStep(form);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;
      setStep("profile");
      return;
    }

    // step === "profile": final, single submit for the whole wizard.
    if (submitting || avatarError) return;

    setSubmitting(true);
    try {
      await register({
        username: form.username.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        nickname: form.nickname.trim() || undefined,
        aboutMe: form.aboutMe.trim() || undefined,
        profilePhoto: avatarFile,
      });
      setSucceeded(true);
      window.setTimeout(() => router.push("/login"), 900);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Could not connect to the server. Please try again.";
      const { step: targetStep, field } = resolveErrorStep(message, step);
      setStep(targetStep);
      if (field) {
        setFieldErrors((current) => ({ ...current, [field]: message }));
      } else {
        setFormError(message);
      }
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <RegisterProgress currentStep={step} />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {step === "account" && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.stepHeading}>Create Account</legend>
            <p className={styles.stepSubheading}>
              Start your journey into the network.
            </p>

            <div className={styles.field}>
              <label htmlFor="register-email" className={styles.label}>
                Email
              </label>
              <input
                id="register-email"
                type="email"
                className={styles.control}
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={
                  fieldErrors.email ? "register-email-error" : undefined
                }
                autoComplete="email"
              />
              {fieldErrors.email && (
                <p id="register-email-error" className={styles.fieldError} role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="register-username" className={styles.label}>
                Username
              </label>
              <input
                id="register-username"
                type="text"
                className={styles.control}
                value={form.username}
                onChange={(event) => updateField("username", event.target.value)}
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={
                  fieldErrors.username ? "register-username-error" : undefined
                }
                autoComplete="username"
              />
              {fieldErrors.username && (
                <p id="register-username-error" className={styles.fieldError} role="alert">
                  {fieldErrors.username}
                </p>
              )}
            </div>

            <PasswordField
              id="register-password"
              label="Password"
              value={form.password}
              error={fieldErrors.password}
              autoComplete="new-password"
              onChange={(value) => updateField("password", value)}
            />

            <PasswordField
              id="register-confirm-password"
              label="Confirm Password"
              value={form.confirmPassword}
              error={fieldErrors.confirmPassword}
              autoComplete="new-password"
              onChange={(value) => updateField("confirmPassword", value)}
            />
          </fieldset>
        )}

        {step === "personal" && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.stepHeading}>Personal Information</legend>
            <p className={styles.stepSubheading}>Tell us a little about you.</p>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="register-first-name" className={styles.label}>
                  First Name
                </label>
                <input
                  id="register-first-name"
                  type="text"
                  className={styles.control}
                  value={form.firstName}
                  onChange={(event) => updateField("firstName", event.target.value)}
                  maxLength={500}
                  aria-invalid={Boolean(fieldErrors.firstName)}
                  aria-describedby={
                    fieldErrors.firstName ? "register-first-name-error" : undefined
                  }
                  autoComplete="given-name"
                />
                {fieldErrors.firstName && (
                  <p
                    id="register-first-name-error"
                    className={styles.fieldError}
                    role="alert"
                  >
                    {fieldErrors.firstName}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="register-last-name" className={styles.label}>
                  Last Name
                </label>
                <input
                  id="register-last-name"
                  type="text"
                  className={styles.control}
                  value={form.lastName}
                  onChange={(event) => updateField("lastName", event.target.value)}
                  maxLength={500}
                  aria-invalid={Boolean(fieldErrors.lastName)}
                  aria-describedby={
                    fieldErrors.lastName ? "register-last-name-error" : undefined
                  }
                  autoComplete="family-name"
                />
                {fieldErrors.lastName && (
                  <p
                    id="register-last-name-error"
                    className={styles.fieldError}
                    role="alert"
                  >
                    {fieldErrors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="register-dob" className={styles.label}>
                Date of Birth
              </label>
              <input
                id="register-dob"
                type="date"
                className={styles.control}
                value={form.dateOfBirth}
                onChange={(event) => updateField("dateOfBirth", event.target.value)}
                max={getTodayInputValue()}
                min={getMinDateOfBirthInputValue()}
                aria-invalid={Boolean(fieldErrors.dateOfBirth)}
                aria-describedby={
                  fieldErrors.dateOfBirth ? "register-dob-error" : undefined
                }
              />
              {fieldErrors.dateOfBirth && (
                <p id="register-dob-error" className={styles.fieldError} role="alert">
                  {fieldErrors.dateOfBirth}
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="register-gender" className={styles.label}>
                Gender
              </label>
              <select
                id="register-gender"
                className={styles.control}
                value={form.gender}
                onChange={(event) => updateField("gender", event.target.value)}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </fieldset>
        )}

        {step === "profile" && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.stepHeading}>Profile Setup</legend>
            <p className={styles.stepSubheading}>
              Add a few finishing touches - all optional.
            </p>

            <div className={styles.avatarRow}>
              <UserAvatar
                src={previewUrl}
                firstName={form.firstName}
                lastName={form.lastName}
                username={form.username}
                size={88}
                alt="Profile photo preview"
              />
              <div className={styles.avatarControls}>
                <div className={styles.avatarButtonRow}>
                  <label className={styles.btnSecondary} htmlFor="register-avatar-upload">
                    Choose Photo
                  </label>
                  <input
                    id="register-avatar-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/gif"
                    className={styles.fileInput}
                    onChange={(event) => {
                      handleAvatarChange(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                  {avatarFile && (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => handleAvatarChange(null)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className={styles.fieldMeta}>JPEG, PNG, or GIF. Maximum 5 MiB.</p>
                {avatarError && (
                  <p className={styles.fieldError} role="alert">
                    {avatarError}
                  </p>
                )}
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="register-nickname" className={styles.label}>
                Nickname
              </label>
              <input
                id="register-nickname"
                type="text"
                className={styles.control}
                value={form.nickname}
                onChange={(event) => updateField("nickname", event.target.value)}
                maxLength={NICKNAME_MAX}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="register-about-me" className={styles.label}>
                Bio / About Me
              </label>
              <textarea
                id="register-about-me"
                className={`${styles.control} ${styles.textarea}`}
                value={form.aboutMe}
                onChange={(event) => updateField("aboutMe", event.target.value)}
                maxLength={ABOUT_ME_MAX}
                placeholder="Tell people a little about yourself..."
              />
              <span className={styles.fieldMeta}>
                {form.aboutMe.length}/{ABOUT_ME_MAX}
              </span>
            </div>
          </fieldset>
        )}

        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        {succeeded && (
          <p className={styles.formSuccess} role="status">
            Account created! Redirecting you to sign in...
          </p>
        )}

        <div className={styles.actions}>
          {step !== "account" && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={goToPreviousStep}
              disabled={submitting}
            >
              Back
            </button>
          )}
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={submitting || succeeded}
          >
            {step !== "profile"
              ? "Continue"
              : submitting
                ? "Creating account..."
                : "Create Account"}
          </button>
        </div>

        {step === "account" && (
          <p className={styles.signInLink}>
            Already have an account? <a href="/login">Sign in</a>
          </p>
        )}
      </form>
    </div>
  );
}
