"use client";

import { type SubmitEvent, useEffect, useMemo, useState } from "react";

import { avatarUrl, updateGroup } from "../api/groups";
import { useGroupAction } from "../hooks/useGroupAction";
import type { Group } from "../types/group";

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;

export default function EditGroupForm({ group }: { group: Group }) {
  const { busy, error, run } = useGroupAction(`edit-group:${group.id}`, group.id);

  const [title, setTitle] = useState(group.title);
  const [description, setDescription] = useState(group.description);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saved, setSaved] = useState(false);

  const photoPreview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const trimmedTitle = title.trim();
  const titleValid = trimmedTitle.length >= TITLE_MIN_LENGTH;
  const remainingDescriptionChars = DESCRIPTION_MAX_LENGTH - description.length;
  const currentPhotoUrl = removePhoto ? undefined : avatarUrl(group.groupPhoto);
  const displayedPhoto = photoPreview ?? currentPhotoUrl;

  function handlePhotoChange(file: File | null) {
    if (!file) return;
    setPhoto(file);
    setRemovePhoto(false);
    setSaved(false);
  }

  function handleRemovePhoto() {
    setPhoto(null);
    setRemovePhoto(true);
    setSaved(false);
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !titleValid) return;

    setSaved(false);
    const success = await run("Saving...", () =>
      updateGroup(group.id, {
        title: trimmedTitle,
        description: description.trim(),
        photo,
        removePhoto,
      }).then(() => undefined),
    );
    if (success) {
      setPhoto(null);
      setRemovePhoto(false);
      setSaved(true);
    }
  }

  return (
    <section className="group-panel group-edit-panel" aria-labelledby="edit-group-heading">
      <div className="group-section-heading">
        <h2 id="edit-group-heading">Edit Group</h2>
      </div>
      <form onSubmit={handleSubmit} className="group-form">
        <div className="form-field">
          <label htmlFor="edit-group-photo">Group photo</label>
          <div className="group-photo-picker">
            {displayedPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayedPhoto} alt="" className="group-photo-preview" />
            ) : (
              <span className="group-photo-preview-empty" aria-hidden="true">
                {trimmedTitle.charAt(0).toUpperCase() || "?"}
              </span>
            )}
            <div className="group-buttons">
              <label className="group-button secondary" htmlFor="edit-group-photo">
                Change photo
              </label>
              <input
                id="edit-group-photo"
                type="file"
                accept="image/jpeg,image/png,image/gif"
                className="sr-only"
                disabled={Boolean(busy)}
                onChange={(event) => {
                  handlePhotoChange(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              {displayedPhoto && (
                <button
                  type="button"
                  className="group-button secondary"
                  disabled={Boolean(busy)}
                  onClick={handleRemovePhoto}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
          <p className="group-field-hint">JPEG, PNG, or GIF.</p>
        </div>

        <div className="form-field">
          <label htmlFor="edit-group-title">Group name</label>
          <input
            id="edit-group-title"
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setSaved(false);
            }}
            minLength={TITLE_MIN_LENGTH}
            maxLength={TITLE_MAX_LENGTH}
            disabled={Boolean(busy)}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="edit-group-description">Description</label>
          <textarea
            id="edit-group-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setSaved(false);
            }}
            maxLength={DESCRIPTION_MAX_LENGTH}
            rows={5}
            disabled={Boolean(busy)}
          />
          <p className="group-field-hint">
            {remainingDescriptionChars} characters left.
          </p>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="form-success" role="status">
            Group updated successfully.
          </p>
        )}

        <div className="group-edit-actions">
          <button type="submit" disabled={Boolean(busy) || !titleValid}>
            {busy ?? "Save Changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
