"use client";

import { useEffect, useState } from "react";
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from "@/lib/upload";

interface ImageAttachmentFieldProps {
  id: string;
  label: string;
  onChange: (file: File | null) => void;
}

export default function ImageAttachmentField({
  id,
  label,
  onChange,
}: ImageAttachmentFieldProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError("");

    if (!file) {
      setPreview(null);
      onChange(null);
      return;
    }

    const validationError = await validateImageFile(file);
    if (validationError) {
      setError(validationError);
      setPreview(null);
      onChange(null);
      event.target.value = "";
      return;
    }

    setPreview(URL.createObjectURL(file));
    onChange(file);
  }

  function handleRemove() {
    setPreview(null);
    setError("");
    onChange(null);
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) input.value = "";
  }

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>

      <input
        id={id}
        name={id}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        onChange={handleFileChange}
      />

      {error && <p className="form-error">{error}</p>}

      {preview && (
        <div className="image-attachment-preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- local
              blob: object URL, not a remote image next/image can optimize */}
          <img src={preview} alt="Selected attachment preview" />
          <button type="button" onClick={handleRemove}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
