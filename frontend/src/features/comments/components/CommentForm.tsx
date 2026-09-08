"use client";

import { useEffect, useRef, useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { validateImageFile } from "@/lib/upload";
import styles from "./CommentForm.module.css";

interface CommentFormProps {
  onSubmit: (content: string, image?: File | null) => Promise<void>;
}

export default function CommentForm({ onSubmit }: CommentFormProps) {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Clean up object URL on unmount or when image changes
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Adjust textarea height dynamically
  function adjustTextareaHeight() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function handleContentChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(event.target.value);
    adjustTextareaHeight();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError("");

    if (!file) {
      removeAttachment();
      return;
    }

    const validationError = await validateImageFile(file);
    if (validationError) {
      setError(validationError);
      removeAttachment();
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setImage(file);
  }

  function removeAttachment() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openFilePicker(accept: string) {
    setMenuOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  }

  async function submitComment() {
    if (!content.trim() || loading) return;

    setError("");
    setLoading(true);

    try {
      await onSubmit(content.trim(), image);
      setContent("");
      removeAttachment();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitComment();
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitComment();
  }

  return (
    <form onSubmit={handleSubmit} className={styles.composer}>
      {/* Hidden file input — browser default UI is NEVER visible */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileChange}
      />

      {/* Attachment Preview */}
      {preview && (
        <div className={styles.previewContainer}>
          <div className={styles.previewWrapper}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Attachment preview"
              className={styles.previewImg}
            />
            <button
              type="button"
              className={styles.removePreviewBtn}
              onClick={removeAttachment}
              aria-label="Remove attachment"
              title="Remove attachment"
            >
              <AppIcon name="x" width={12} height={12} />
            </button>
          </div>
        </div>
      )}

      {/* Composer Input Row */}
      <div className={styles.inputRow}>
        <div className={styles.composerAvatar} aria-hidden="true">
          <AppIcon name="user" width={16} height={16} />
        </div>

        <div className={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment..."
            rows={1}
            maxLength={2000}
            className={styles.textarea}
            aria-label="Write a comment"
            required
          />
        </div>

        {/* Plus Button with Dropdown Menu */}
        <div className={styles.attachWrapper} ref={menuContainerRef}>
          <button
            type="button"
            className={styles.attachBtn}
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label="Add media to comment"
            title="Add media"
          >
            <AppIcon name="plus" width={16} height={16} />
          </button>

          {menuOpen && (
            <div className={styles.plusMenu} role="menu">
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() =>
                  openFilePicker("image/jpeg,image/png,image/webp")
                }
              >
                <AppIcon name="image" width={16} height={16} />
                <span>Add image</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => openFilePicker("image/gif")}
              >
                <AppIcon name="gif" width={16} height={16} />
                <span>Add GIF</span>
              </button>
            </div>
          )}
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className={styles.sendBtn}
          aria-label="Send comment"
        >
          {loading ? "…" : "Send"}
        </button>
      </div>

      {error && (
        <p className={styles.composerError} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
