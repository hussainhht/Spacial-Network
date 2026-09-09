"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createGroupPost } from "@/features/posts/api/posts";
import ImageAttachmentField from "@/components/ImageAttachmentField";
import { useGroupAction } from "../hooks/useGroupAction";

interface CreateGroupPostModalProps {
  groupId: number;
  onClose: () => void;
}

// Mounted only while open (see GroupPosts), so each opening is a fresh
// instance - form fields naturally start blank without a reset effect.
export default function CreateGroupPostModal({
  groupId,
  onClose,
}: CreateGroupPostModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const { busy, error, run } = useGroupAction(
    `create-group-post:${groupId}`,
    groupId,
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const scrollContainer = document.getElementById("page-content");
    const previousOverflow = scrollContainer?.style.overflow ?? "";
    if (scrollContainer) scrollContainer.style.overflow = "hidden";

    return () => {
      if (scrollContainer) scrollContainer.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) {
      setFormError("Title and content cannot be empty.");
      return;
    }

    setFormError(null);
    const ok = await run("Posting…", async () => {
      await createGroupPost(groupId, {
        title: trimmedTitle,
        content: trimmedContent,
        image,
      });
    });
    if (ok) onClose();
  }

  return createPortal(
    <div className="group-modal-overlay" onClick={onClose}>
      <div
        className="group-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-post-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="group-modal-header">
          <h2 id="create-group-post-modal-title">New Post</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="group-modal-close"
            aria-label="Close new post dialog"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="group-modal-body">
          <form onSubmit={handleSubmit} className="group-form">
            <div className="form-field">
              <label htmlFor="group-post-title">Title</label>
              <input
                id="group-post-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="group-post-content">Content</label>
              <textarea
                id="group-post-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={5}
                required
              />
            </div>

            <ImageAttachmentField
              id="group-post-image"
              label="Image (optional)"
              onChange={setImage}
            />

            {(formError || error) && (
              <p className="form-error" role="alert">
                {formError ?? error}
              </p>
            )}

            <div className="group-create-actions-bar">
              <button
                type="button"
                className="group-button secondary"
                onClick={onClose}
                disabled={Boolean(busy)}
              >
                Cancel
              </button>
              <button type="submit" disabled={Boolean(busy)}>
                {busy ?? "Post"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
