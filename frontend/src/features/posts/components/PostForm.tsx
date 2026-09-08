"use client";

import { useState } from "react";
import type { PostInput } from "@/features/posts/types/post";
import ImageAttachmentField from "@/components/ImageAttachmentField";

interface PostFormProps {
  initialValues?: PostInput;
  submitLabel: string;
  pendingLabel: string;
  showImage?: boolean;
  onSubmit: (input: PostInput & { image?: File | null }) => Promise<void>;
}

export default function PostForm({
  initialValues,
  submitLabel,
  pendingLabel,
  showImage = false,
  onSubmit,
}: PostFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [content, setContent] = useState(initialValues?.content ?? "");
  const [isPrivate, setPrivate] = useState(initialValues?.private ?? false);
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await onSubmit({ title, content, private: isPrivate, image });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="post-form">
      <div className="form-field">
        <label htmlFor="title">Title</label>

        <input
          id="title"
          name="title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Enter your post title"
          maxLength={200}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="content">Content</label>

        <textarea
          id="content"
          name="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write your post..."
          rows={12}
          maxLength={10000}
          required
        />
      </div>

      <div className="form-field form-field-checkbox">
        <label htmlFor="private">
          <input
            id="private"
            name="private"
            type="checkbox"
            checked={isPrivate}
            onChange={(event) => setPrivate(event.target.checked)}
          />
          Private post?
        </label>
      </div>

      {showImage && (
        <ImageAttachmentField
          id="image"
          label="Image or GIF (optional)"
          onChange={setImage}
        />
      )}

      {error && <p className="form-error">{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
