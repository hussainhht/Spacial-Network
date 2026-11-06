import { DEMO_MODE } from "@/demo/config";
import type { PostVisibility } from "@/features/posts/types/post";

const DRAFT_VERSION = 1;
const VISIBILITIES: readonly PostVisibility[] = ["public", "followers", "custom"];
const MAX_TITLE = 200;
const MAX_CONTENT = 10000;
const MAX_VIEWERS = 500;

export interface PostDraft {
  title: string;
  content: string;
  visibility: PostVisibility;
  viewerIds: number[];
  /** Images are never stored; this only reminds the user to attach them again. */
  hadImages: boolean;
  savedAt: number;
}

export type DraftValues = Omit<PostDraft, "savedAt">;

export function draftStorageKey(userId: number) {
  return `spacial-network:post-draft:v${DRAFT_VERSION}:${DEMO_MODE ? "demo" : "app"}:${userId}`;
}

export function isEmptyDraft(values: Pick<DraftValues, "title" | "content">) {
  return values.title.trim() === "" && values.content.trim() === "";
}

/** Stable signature used to skip writes when nothing meaningful changed. */
export function draftSignature(values: DraftValues) {
  return JSON.stringify([values.title, values.content, values.visibility, values.viewerIds, values.hadImages]);
}

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Returns a sanitized draft, or null when the data is malformed, outdated or owned by someone else. */
export function parseDraft(raw: string | null, userId: number): PostDraft | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.version !== DRAFT_VERSION || d.userId !== userId) return null;
  if (typeof d.title !== "string" || typeof d.content !== "string") return null;
  if (typeof d.savedAt !== "number" || !Number.isFinite(d.savedAt)) return null;
  if (!VISIBILITIES.includes(d.visibility as PostVisibility)) return null;
  if (!Array.isArray(d.viewerIds)) return null;
  const viewerIds = [...new Set(d.viewerIds.filter((id): id is number => Number.isInteger(id) && id > 0))].slice(0, MAX_VIEWERS);
  const draft: PostDraft = {
    title: d.title.slice(0, MAX_TITLE),
    content: d.content.slice(0, MAX_CONTENT),
    visibility: d.visibility as PostVisibility,
    viewerIds,
    hadImages: d.hadImages === true,
    savedAt: d.savedAt,
  };
  return isEmptyDraft(draft) ? null : draft;
}

export function readDraft(key: string, userId: number): PostDraft | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    const draft = parseDraft(raw, userId);
    if (raw && !draft) storage.removeItem(key);
    return draft;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, userId: number, values: DraftValues): PostDraft | null {
  const storage = getStorage();
  if (!storage) return null;
  const draft: PostDraft = { ...values, savedAt: Date.now() };
  try {
    storage.setItem(key, JSON.stringify({ version: DRAFT_VERSION, userId, ...draft }));
    return draft;
  } catch {
    return null;
  }
}

export function removeDraft(key: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function formatSavedAgo(savedAt: number, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - savedAt) / 1000));
  if (seconds < 60) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), "minute");
  if (seconds < 86400) return rtf.format(-Math.round(seconds / 3600), "hour");
  return rtf.format(-Math.round(seconds / 86400), "day");
}
