"use client";

import { useState } from "react";
import type { PostInput, PostVisibility } from "@/features/posts/types/post";
import ImageAttachmentField from "@/components/ImageAttachmentField";
import CustomViewerPicker from "./CustomViewerPicker";

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
  const [visibility, setVisibility] = useState<PostVisibility>(
    initialValues?.visibility ?? "public",
  );
  const [viewerIds, setViewerIds] = useState<number[]>(
    initialValues?.viewerIds ?? [],
  );
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await onSubmit({ title, content, visibility, viewerIds, image });
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

      <div className="form-field">
        <label htmlFor="visibility">Who can see this post?</label>

        <select
          id="visibility"
          name="visibility"
          value={visibility}
          onChange={(event) =>
            setVisibility(event.target.value as PostVisibility)
          }
        >
          <option value="public">Public - anyone on the platform</option>
          <option value="followers">Followers only</option>
          <option value="custom">Custom - only people I choose</option>
        </select>
      </div>

      {visibility === "custom" && (
        <CustomViewerPicker
          selectedIds={viewerIds}
          onChange={setViewerIds}
        />
      )}

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
