"use client";

import { FormEvent, useState } from "react";
import { changePassword } from "../api/settings";
import styles from "./SettingsPage.module.css";

type PasswordFieldName = "currentPassword" | "newPassword" | "confirmPassword";

interface PasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMPTY_PASSWORDS: PasswordValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const labels: Record<PasswordFieldName, string> = {
  currentPassword: "Current password",
  newPassword: "New password",
  confirmPassword: "Confirm new password",
};

function PasswordField({
  name,
  value,
  visible,
  error,
  disabled,
  onChange,
  onToggleVisibility,
}: {
  name: PasswordFieldName;
  value: string;
  visible: boolean;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
}) {
  const inputId = `settings-${name}`;
  const errorId = `${inputId}-error`;
  const isCurrent = name === "currentPassword";

  return (
    <div className={styles.formField}>
      <label className={styles.formLabel} htmlFor={inputId}>
        {labels[name]}
      </label>
      <div className={styles.passwordControl}>
        <input
          id={inputId}
          className={styles.formControl}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={isCurrent ? "current-password" : "new-password"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
          required
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className={styles.visibilityButton}
          aria-label={`${visible ? "Hide" : "Show"} ${labels[name].toLowerCase()}`}
          aria-pressed={visible}
          disabled={disabled}
          onClick={onToggleVisibility}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {error && (
        <span id={errorId} className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export default function PasswordForm() {
  const [values, setValues] = useState<PasswordValues>(EMPTY_PASSWORDS);
  const [visible, setVisible] = useState<Record<PasswordFieldName, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<PasswordFieldName, string>>
  >({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setField(name: PasswordFieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setRequestError(null);
    setSuccess(null);
  }

  function validate(): boolean {
    const errors: Partial<Record<PasswordFieldName, string>> = {};
    if (!values.currentPassword) {
      errors.currentPassword = "Enter your current password.";
    }

    const normalizedNewPassword = values.newPassword.trim();
    if (!values.newPassword) {
      errors.newPassword = "Enter a new password.";
    } else if (normalizedNewPassword.length < 8) {
      errors.newPassword = "Use at least 8 characters.";
    } else if (new TextEncoder().encode(normalizedNewPassword).length > 72) {
      errors.newPassword = "Use no more than 72 bytes.";
    }

    if (!values.confirmPassword) {
      errors.confirmPassword = "Confirm your new password.";
    } else if (values.newPassword !== values.confirmPassword) {
      errors.confirmPassword = "The new passwords do not match.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !validate()) return;

    setSaving(true);
    setRequestError(null);
    setSuccess(null);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      setValues(EMPTY_PASSWORDS);
      setVisible({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
      });
      setSuccess("Your password has been changed.");
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Could not change password.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.passwordForm} onSubmit={handleSubmit} noValidate>
      {(Object.keys(values) as PasswordFieldName[]).map((name) => (
        <PasswordField
          key={name}
          name={name}
          value={values[name]}
          visible={visible[name]}
          error={fieldErrors[name]}
          disabled={saving}
          onChange={(value) => setField(name, value)}
          onToggleVisibility={() =>
            setVisible((current) => ({ ...current, [name]: !current[name] }))
          }
        />
      ))}

      <p className={styles.formHint}>
        Use 8–72 characters. Your current session will stay signed in.
      </p>

      {requestError && (
        <p className={styles.feedbackError} role="alert">
          {requestError}
        </p>
      )}
      {success && (
        <p className={styles.feedbackSuccess} role="status">
          {success}
        </p>
      )}

      <div className={styles.formActions}>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={saving}
        >
          {saving ? "Changing password…" : "Change password"}
        </button>
      </div>
    </form>
  );
}
