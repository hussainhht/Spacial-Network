"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppIcon, { type AppIconName } from "@/components/layout/AppIcon";
import { useActionFeedback } from "@/components/feedback/ActionFeedbackProvider";
import { useCurrentUser } from "@/features/auth/context/CurrentUserContext";
import { createPost } from "@/features/posts/api/posts";
import PostCard from "@/features/posts/components/PostCard";
import type { Post, PostMedia, PostVisibility } from "@/features/posts/types/post";
import { ACCEPTED_IMAGE_TYPES, MAX_POST_MEDIA, validateImageFile } from "@/lib/upload";
import CustomViewerPicker from "./CustomViewerPicker";
import styles from "./NewPostForm.module.css";

const privacyOptions: Array<{
  value: PostVisibility;
  label: string;
  description: string;
  icon: AppIconName;
}> = [
  { value: "public", label: "Public", description: "Everyone", icon: "globe" },
  { value: "followers", label: "Followers", description: "Followers only", icon: "groups" },
  { value: "custom", label: "Selected", description: "Specific people", icon: "lock" },
];

interface SelectedMedia {
  key: string;
  file: File;
  url: string;
}

export default function NewPostForm() {
  const router = useRouter();
  const { notify } = useActionFeedback();
  const { user } = useCurrentUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<SelectedMedia[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [viewerIds, setViewerIds] = useState<number[]>([]);
  const [media, setMedia] = useState<SelectedMedia[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  useEffect(() => () => {
    mediaRef.current.forEach((item) => URL.revokeObjectURL(item.url));
  }, []);

  async function addFiles(files: FileList | File[]) {
    setError("");
    const available = MAX_POST_MEDIA - mediaRef.current.length;
    if (available <= 0) {
      setError(`You can attach up to ${MAX_POST_MEDIA} media items.`);
      return;
    }
    const incoming = Array.from(files);
    if (incoming.length > available) {
      setError(`Only ${available} more ${available === 1 ? "item" : "items"} can be added.`);
      return;
    }

    const additions: SelectedMedia[] = [];
    for (const file of incoming) {
      const validationError = await validateImageFile(file);
      if (validationError) {
        additions.forEach((item) => URL.revokeObjectURL(item.url));
        setError(`${file.name}: ${validationError}`);
        return;
      }
      additions.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        url: URL.createObjectURL(file),
      });
    }
    setMedia((current) => {
      const next = [...current, ...additions];
      mediaRef.current = next;
      return next;
    });
  }

  function removeMedia(key: string) {
    setMedia((current) => {
      const removed = current.find((item) => item.key === key);
      if (removed) URL.revokeObjectURL(removed.url);
      const next = current.filter((item) => item.key !== key);
      mediaRef.current = next;
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      await createPost({ title, content, visibility, viewerIds, media: media.map((item) => item.file) });
      notify("Post published.");
      router.push("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create post";
      setError(message);
      notify(message, "error");
      setLoading(false);
    }
  }

  const previewMedia: PostMedia[] = media.map((item, order) => ({
    id: order, url: item.url, type: item.file.type === "image/gif" ? "gif" : "image", order,
  }));
  const previewPost: Post = {
    id: 0,
    user_id: user.user_id,
    author: {
      id: user.user_id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      profile_photo: user.profile_photo,
    },
    visibility,
    title: title || "Your post title",
    content: content || "Your story will appear here as you write.",
    media: previewMedia,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_owner: true,
    can_delete: true,
    viewer_ids: visibility === "custom" ? viewerIds : undefined,
  };

  return (
    <div className={styles.pageContent}>
      <Link href="/" className={styles.backLink}>
        <AppIcon name="arrowLeft" width={17} height={17} /> Back to home
      </Link>

      <div className={styles.layout}>
        <form id="new-post-form" className={styles.composer} onSubmit={handleSubmit}>
          <header className={styles.panelHeader}>
            <span className={styles.headerIcon}><AppIcon name="plus" /></span>
            <div><h1>Create a new post</h1><p>Share something with the community.</p></div>
          </header>

          <div className={styles.field}>
            <label htmlFor="post-title">Title</label>
            <input id="post-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="Give your post a title" required />
            <span className={styles.count}>{title.length}/200</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="post-content">Content</label>
            <textarea id="post-content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={10000} rows={8} placeholder="What would you like to share?" required />
            <span className={styles.count}>{content.length}/10,000</span>
          </div>

          <section className={styles.section} aria-labelledby="media-heading">
            <div className={styles.sectionHeading}><div><h2 id="media-heading">Media</h2><p>JPEG, PNG, GIF or WebP · 5 MB each</p></div><span>{media.length}/{MAX_POST_MEDIA}</span></div>
            {media.length === 0 && <button
              className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`}
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); void addFiles(event.dataTransfer.files); }}
            >
              <span className={styles.uploadIcon}><AppIcon name="image" width={25} height={25} /></span>
              <strong>Upload images or GIFs</strong>
              <span>Drag and drop or click to browse</span>
            </button>}
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              multiple
              aria-label="Choose post images or GIFs"
              onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ""; }}
            />

            {media.length > 0 && <div className={styles.thumbnails} aria-label="Selected media">
              {media.map((item, index) => <div className={styles.thumbnail} key={item.key}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={`Selected attachment ${index + 1}`} />
                <button type="button" onClick={() => removeMedia(item.key)} aria-label={`Remove ${item.file.name}`} title="Remove attachment"><AppIcon name="x" width={15} height={15} /></button>
                <span>{index + 1}</span>
              </div>)}
              {media.length < MAX_POST_MEDIA && <button className={styles.addTile} type="button" onClick={() => inputRef.current?.click()}><AppIcon name="plus" /><span>Add</span></button>}
            </div>}
          </section>

          {error && <p className={styles.error} role="alert" aria-live="assertive">{error}</p>}
        </form>

        <aside className={styles.preview} aria-labelledby="preview-heading">
          <header className={styles.previewHeader}><div><h2 id="preview-heading">Post preview</h2><p>This is how your post will look.</p></div><span>Live</span></header>
          <PostCard post={previewPost} preview />
          <div className={styles.previewControls}>
            <fieldset className={styles.privacy}>
              <legend>Who can see this post?</legend>
              <div className={styles.privacyGrid}>
                {privacyOptions.map((option) => <label className={`${styles.privacyOption} ${visibility === option.value ? styles.selected : ""}`} key={option.value}>
                  <input className="sr-only" type="radio" name="visibility" value={option.value} checked={visibility === option.value} onChange={() => setVisibility(option.value)} />
                  <AppIcon name={option.icon} />
                  <span><strong>{option.label}</strong><small>{option.description}</small></span>
                </label>)}
              </div>
            </fieldset>

            {visibility === "custom" && <div className={styles.audience}><CustomViewerPicker selectedIds={viewerIds} onChange={setViewerIds} /></div>}

            <div className={styles.actions}>
              <Link href="/">Cancel</Link>
              <button type="submit" form="new-post-form" disabled={loading}>{loading ? "Creating…" : <><AppIcon name="send" width={17} height={17} /> Create post</>}</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
