"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import AppIcon from "@/components/layout/AppIcon";
import formStyles from "./AuthForm.module.css";
import styles from "./ProfilePhotoUpload.module.css";

interface ProfilePhotoUploadProps {
  value: File | null;
  onChange: (file: File | null) => void;
}

export default function ProfilePhotoUpload({
  value,
  onChange,
}: ProfilePhotoUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(
    () => (value ? URL.createObjectURL(value) : null),
    [value],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className={formStyles.field}>
      <label htmlFor={inputId} className={formStyles.label}>
        Profile Photo <span className={formStyles.optional}>(Optional)</span>
      </label>

      <div className={styles.dropzone}>
        <div className={styles.avatarPreview}>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a served asset
            <img src={previewUrl} alt="" className={styles.avatarImage} />
          ) : (
            <AppIcon name="user" width={26} height={26} />
          )}
        </div>

        <div className={styles.dropzoneInfo}>
          <p className={styles.dropzoneTitle}>
            {value ? value.name : "Upload a profile photo"}
          </p>
          <p className={styles.dropzoneHint}>JPEG, PNG or GIF</p>
        </div>

        <button
          type="button"
          className={styles.chooseButton}
          onClick={() => inputRef.current?.click()}
        >
          <AppIcon name="upload" width={16} height={16} />
          {value ? "Change Image" : "Choose Image"}
        </button>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/gif"
          className={styles.hiddenInput}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            onChange(file);
          }}
        />
      </div>
    </div>
  );
}
