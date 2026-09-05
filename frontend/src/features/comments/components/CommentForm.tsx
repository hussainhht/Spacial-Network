"use client";

import { useState } from "react";

interface CommentFormProps {
  onSubmit: (content: string) => Promise<void>;
}

export default function CommentForm({ onSubmit }: CommentFormProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await onSubmit(content);
      setContent("");
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

      {error && <p className="form-error">{error}</p>}

      <button type="submit" disabled={loading || !content.trim()}>
        {loading ? "Posting..." : "Post comment"}
      </button>
    </form>
  );
}
