"use client";

import { useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import styles from "./AuthForm.module.css";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>

      <div className={styles.passwordWrap}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={styles.input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
        />

        <button
          type="button"
          className={styles.passwordToggle}
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          <AppIcon name={visible ? "eye-off" : "eye"} width={18} height={18} />
        </button>
      </div>
    </div>
  );
}
