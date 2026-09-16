"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import AppIcon from "@/components/layout/AppIcon";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  validateImageFile,
} from "@/lib/upload";

export const EVENT_COVER_TEMPLATES = [
  { name: "Earth", path: "/image/templets/earth.png" },
  { name: "Mars", path: "/image/templets/mars.png" },
  { name: "Moon", path: "/image/templets/moon.png" },
  { name: "Saturn", path: "/image/templets/saturn.png" },
] as const;

interface EventCoverPickerProps {
  selectedTemplate: string | null;
  image: File | null;
  onTemplateChange: (path: string | null) => void;
  onImageChange: (file: File | null) => void;
}

export default function EventCoverPicker({
  selectedTemplate,
  image,
  onTemplateChange,
  onImageChange,
}: EventCoverPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const objectUrl = uploadPreview;
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image, uploadPreview]);

  function clearFileInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectTemplate(path: string) {
    setUploadError("");
    clearFileInput();
    setUploadPreview(null);
    onImageChange(null);
    onTemplateChange(path);
  }

  async function selectFile(file: File | null) {
    setUploadError("");
    if (!file) {
      setUploadPreview(null);
      onImageChange(null);
      return;
    }
    const validationError = await validateImageFile(file);
    if (validationError) {
      setUploadError(validationError);
      clearFileInput();
      setUploadPreview(null);
      onImageChange(null);
      return;
    }
    onTemplateChange(null);
    setUploadPreview(URL.createObjectURL(file));
    onImageChange(file);
  }

  function removeCover() {
    setUploadError("");
    clearFileInput();
    setUploadPreview(null);
    onTemplateChange(null);
    onImageChange(null);
  }

  const preview = selectedTemplate ?? (image ? uploadPreview : null);
  const previewName = selectedTemplate
    ? EVENT_COVER_TEMPLATES.find((template) => template.path === selectedTemplate)
        ?.name
    : image?.name;

  return (
    <fieldset className="event-cover-picker">
      <legend>
        Event cover <span>(optional)</span>
      </legend>

      {preview && (
        <div className="event-cover-preview">
          {selectedTemplate ? (
            <Image
              src={selectedTemplate}
              alt=""
              fill
              sizes="(max-width: 980px) 520px, 340px"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- blob preview */
            <img src={preview} alt="" />
          )}
          <div>
            <span>{previewName}</span>
            <button type="button" onClick={removeCover}>
              Remove cover
            </button>
          </div>
        </div>
      )}

      <p className="event-cover-picker-label">Choose a template</p>
      <div className="event-cover-template-grid">
        {EVENT_COVER_TEMPLATES.map((template) => {
          const selected = selectedTemplate === template.path;
          return (
            <button
              key={template.path}
              type="button"
              className={selected ? "is-selected" : undefined}
              aria-pressed={selected}
              onClick={() => selectTemplate(template.path)}
            >
              <Image
                src={template.path}
                alt=""
                width={188}
                height={94}
                sizes="(max-width: 660px) 42vw, (max-width: 980px) 21vw, 150px"
              />
              <span>{template.name}</span>
              {selected && <strong aria-hidden="true">✓</strong>}
            </button>
          );
        })}
      </div>

      <div className="event-cover-divider" aria-hidden="true">
        <span>or</span>
      </div>

      <label
        className={`event-cover-upload${dragging ? " is-dragging" : ""}`}
        htmlFor="event-cover-upload"
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void selectFile(event.dataTransfer.files[0] ?? null);
        }}
      >
        <AppIcon name="image" width={19} height={19} />
        <span>
          <strong>Upload your own</strong>
          <small>Drop an image or choose a file</small>
          <small>
            JPG, PNG, GIF or WEBP · up to {MAX_IMAGE_SIZE / 1024 / 1024}
            MB
          </small>
        </span>
      </label>
      <input
        ref={inputRef}
        id="event-cover-upload"
        className="sr-only"
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        aria-invalid={Boolean(uploadError)}
        aria-describedby={uploadError ? "event-cover-error" : undefined}
        onChange={(event) => void selectFile(event.target.files?.[0] ?? null)}
      />
      {uploadError && (
        <p id="event-cover-error" className="event-field-error" role="alert">
          {uploadError}
        </p>
      )}
    </fieldset>
  );
}
