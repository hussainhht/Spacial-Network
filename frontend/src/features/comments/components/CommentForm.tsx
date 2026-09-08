"use client";

import { useState } from "react";
import ImageAttachmentField from "@/components/ImageAttachmentField";

interface CommentFormProps {
  onSubmit: (content: string, image?: File | null) => Promise<void>;
}

export default function CommentForm({ onSubmit }: CommentFormProps) {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageFieldKey, setImageFieldKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await onSubmit(content, image);
      setContent("");
      setImage(null);
      // Remount the file input so its selected file is cleared.
      setImageFieldKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="comment-form">
      <div className="form-field">
        <label htmlFor="comment-content" className="sr-only">
          Add a comment
        </label>

        <textarea
          id="comment-content"
          name="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write a comment..."
          rows={3}
          maxLength={2000}
          required
        />
      </div>

      <ImageAttachmentField
        key={imageFieldKey}
        id="comment-image"
        label="Image or GIF (optional)"
        onChange={setImage}
      />

      {error && <p className="form-error">{error}</p>}

      <button type="submit" disabled={loading || !content.trim()}>
        {loading ? "Posting..." : "Post comment"}
      </button>
    </form>
  );
}
