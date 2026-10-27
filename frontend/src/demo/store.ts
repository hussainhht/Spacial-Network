import { createSeed, DEMO_USERS, type DemoState } from "./seed";

export const STORAGE_KEY = "spacial-demo:v1";
let state: DemoState | undefined;
let storageWarning = "";
export function getDemoState(): DemoState {
  if (state) return state;
  const seed = createSeed();
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = parseDemoStorage(raw);
    }
  } catch {
    storageWarning =
      "Browser storage is unavailable. Changes last for this visit.";
  }
  state ??= seed;
  return state;
}
export function parseDemoStorage(raw: string): DemoState {
  try {
    const candidate: unknown = JSON.parse(raw);
    if (validState(candidate)) return candidate;
  } catch {
    /* Restore a complete graph when storage is malformed. */
  }
  return createSeed();
}
function validState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (
    v.version !== 1 ||
    !Number.isSafeInteger(v.nextId) ||
    Number(v.nextId) < 1000 ||
    !DEMO_USERS.some((u) => u.id === v.currentUserId)
  )
    return false;
  // Validate domain shapes and references before accepting stored data.
  const record = (x: unknown): x is Record<string, unknown> =>
    !!x && typeof x === "object" && !Array.isArray(x);
  const rows = (key: string, check: (x: Record<string, unknown>) => boolean) =>
    Array.isArray(v[key]) && v[key].every((x) => record(x) && check(x));
  const num = (x: unknown) => typeof x === "number" && Number.isSafeInteger(x);
  const str = (x: unknown) => typeof x === "string";
  const date = (x: unknown) =>
    typeof x === "string" && Number.isFinite(Date.parse(x));
  const userIds = new Set(DEMO_USERS.map((u) => u.id));
  if (
    !rows(
      "users",
      (x) =>
        num(x.id) &&
        userIds.has(Number(x.id)) &&
        [
          x.username,
          x.first_name,
          x.last_name,
          x.profile_photo,
          x.about_me,
          x.nickname,
          x.email,
          x.date_of_birth,
        ].every(str) &&
        typeof x.is_private === "boolean",
    ) ||
    (v.users as unknown[]).length !== 16
  )
    return false;
  if (
    !rows(
      "groups",
      (x) =>
        num(x.id) &&
        num(x.creator_id) &&
        [
          x.title,
          x.description,
          x.created_at,
          x.updated_at,
          x.creator_username,
        ].every(str) &&
        (x.privacy === "public" || x.privacy === "private"),
    )
  )
    return false;
  if (
    !rows(
      "posts",
      (x) =>
        num(x.id) &&
        num(x.user_id) &&
        str(x.title) &&
        str(x.content) &&
        date(x.created_at) &&
        record(x.author) &&
        str(x.author.username) &&
        (x.group_id === undefined || num(x.group_id)) &&
        (x.viewer_ids === undefined ||
          (Array.isArray(x.viewer_ids) && x.viewer_ids.every(num))) &&
        Array.isArray(x.media) &&
        x.media.every((m) => record(m) && str(m.url) && num(m.id)) &&
        ["public", "followers", "custom"].includes(String(x.visibility)),
    )
  )
    return false;
  if (
    !rows(
      "comments",
      (x) =>
        num(x.id) &&
        num(x.post_id) &&
        num(x.user_id) &&
        str(x.content) &&
        date(x.created_at) &&
        record(x.author),
    )
  )
    return false;
  if (
    !rows(
      "events",
      (x) =>
        num(x.id) &&
        num(x.group_id) &&
        str(x.title) &&
        str(x.description) &&
        date(x.event_time),
    )
  )
    return false;
  if (
    !rows("memberships", (x) => num(x.groupId) && num(x.userId) && str(x.role))
  )
    return false;
  if (
    !rows("followRequests", (x) => num(x.id) && num(x.from) && num(x.to)) ||
    !rows(
      "invitations",
      (x) => num(x.id) && num(x.from) && num(x.to) && num(x.groupId),
    ) ||
    !rows("joinRequests", (x) => num(x.id) && num(x.groupId) && num(x.userId))
  )
    return false;
  if (
    !Array.isArray(v.follows) ||
    !v.follows.every((x) => Array.isArray(x) && x.length === 2 && x.every(num))
  )
    return false;
  if (
    !rows(
      "messages",
      (x) =>
        num(x.id) &&
        num(x.sender_id) &&
        num(x.recipient_id) &&
        str(x.content) &&
        str(x.created_at),
    ) ||
    !rows(
      "groupMessages",
      (x) =>
        num(x.id) &&
        num(x.user_id) &&
        num(x.group_id) &&
        str(x.content) &&
        str(x.created_at),
    )
  )
    return false;
  if (
    !rows(
      "notifications",
      (x) =>
        num(x.id) &&
        num(x.userId) &&
        str(x.type) &&
        str(x.message) &&
        str(x.created_at),
    )
  )
    return false;
  if (
    !record(v.likes) ||
    !Object.values(v.likes).every((x) => Array.isArray(x) && x.every(num)) ||
    !record(v.rsvps) ||
    !Object.values(v.rsvps).every(
      (x) =>
        record(x) &&
        Object.values(x).every((r) => r === "going" || r === "not_going"),
    )
  )
    return false;
  const typed = value as DemoState;
  if (new Set(typed.users.map((u) => u.id)).size !== 16) return false;
  const groups = new Set(typed.groups.map((g) => g.id)),
    posts = new Set(typed.posts.map((p) => p.id));
  if (typed.groups.some((g) => !userIds.has(g.creator_id))) return false;
  if (
    typed.posts.some(
      (p) =>
        !userIds.has(p.user_id) ||
        (p.group_id !== undefined && !groups.has(p.group_id)),
    )
  )
    return false;
  if (
    typed.comments.some((c) => !posts.has(c.post_id) || !userIds.has(c.user_id))
  )
    return false;
  if (typed.events.some((e) => !groups.has(e.group_id))) return false;
  if (
    typed.memberships.some(
      (m) => !groups.has(m.groupId) || !userIds.has(m.userId),
    )
  )
    return false;
  if (typed.follows.some((f) => !f.every((id) => userIds.has(id))))
    return false;
  if (
    typed.followRequests.some((r) => !userIds.has(r.from) || !userIds.has(r.to))
  )
    return false;
  if (
    typed.invitations.some(
      (i) =>
        !groups.has(i.groupId) || !userIds.has(i.from) || !userIds.has(i.to),
    )
  )
    return false;
  if (
    typed.joinRequests.some(
      (r) => !groups.has(r.groupId) || !userIds.has(r.userId),
    )
  )
    return false;
  if (
    typed.messages.some(
      (m) => !userIds.has(m.sender_id) || !userIds.has(m.recipient_id),
    )
  )
    return false;
  if (
    typed.groupMessages.some(
      (m) => !groups.has(m.group_id) || !userIds.has(m.user_id),
    )
  )
    return false;
  if (
    Object.values(typed.rsvps).some((responses) =>
      Object.keys(responses).some((id) => !userIds.has(Number(id))),
    )
  )
    return false;
  const allIds = [
    ...typed.posts,
    ...typed.comments,
    ...typed.groups,
    ...typed.events,
    ...typed.notifications,
    ...typed.messages,
    ...typed.followRequests,
    ...typed.invitations,
    ...typed.joinRequests,
  ].map((item) => item.id);
  if (allIds.some((id) => id >= typed.nextId)) return false;
  return true;
}
export function saveDemo() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(getDemoState()));
  } catch {
    storageWarning =
      "Storage is full or unavailable. Recent changes last for this visit.";
  }
  window.dispatchEvent(new Event("spacial-demo:change"));
}
export const getStorageWarning = () => storageWarning;
export function switchDemoUser(id: number) {
  if (!DEMO_USERS.some((u) => u.id === id)) return;
  getDemoState().currentUserId = id;
  saveDemo();
  window.location.reload();
}
export function resetDemo() {
  state = createSeed();
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* In-memory reset still works. */
  }
  window.location.reload();
}
