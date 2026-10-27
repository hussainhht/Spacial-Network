/** API-compatible local service. No HTTP requests, authentication token, or global fetch patch. */
import { ApiError } from "@/lib/api/errors";
import type { Post } from "@/features/posts/types/post";
import type { ApiGroup, ApiEvent } from "@/features/groups/types/api";
import type { PrivateMessage } from "@/features/chat/types/chat";
import type {
  WSEvent,
  EventType,
  GroupMessagePayload,
} from "@/lib/websocket/types";
import { DEMO_MODE, postHref, assetPath } from "./config";
import { getDemoState, saveDemo } from "./store";
import { SEED_DATE } from "./seed";

type Emit = (event: WSEvent) => void;
const listeners = new Set<Emit>();
export function subscribeDemo(listener: Emit) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function emit(type: EventType, payload: unknown) {
  listeners.forEach((fn) => fn({ type, payload }));
}
const fail = (message: string, status = 403): never => {
  throw new ApiError(message, status);
};
const now = () => new Date().toISOString();
const me = () => getDemoState().currentUserId;
const user = (id: number) =>
  getDemoState().users.find((u) => u.id === id) ??
  fail("Demo user not found", 404);
const follows = (from: number, to: number) =>
  getDemoState().follows.some((f) => f[0] === from && f[1] === to);
const member = (groupId: number, id = me()) =>
  getDemoState().memberships.find(
    (m) => m.groupId === groupId && m.userId === id,
  );
const group = (id: number) =>
  getDemoState().groups.find((g) => g.id === id) ??
  fail("This demo group no longer exists. Reset Demo to restore it.", 404);
const requireMember = (id: number) =>
  member(id) ?? fail("Join this community to explore its member features.");
const requireCreator = (id: number) =>
  group(id).creator_id === me() ||
  fail("Only the group creator can manage this community.");
function visible(p: Post) {
  if (p.group_id) return !!member(p.group_id);
  const author = user(p.user_id);
  if (p.user_id === me()) return true;
  if (author.is_private && !follows(me(), author.id)) return false;
  return (
    p.visibility === "public" ||
    (p.visibility === "followers" && follows(me(), p.user_id)) ||
    (p.visibility === "custom" && !!p.viewer_ids?.includes(me()))
  );
}
function post(id: number) {
  const p =
    getDemoState().posts.find((p) => p.id === id) ??
    fail("This demo post no longer exists. Reset Demo to restore it.", 404);
  if (!visible(p)) fail("This post is restricted to its audience.");
  return p;
}
function viewPost(p: Post): Post {
  return {
    ...p,
    author: user(p.user_id),
    is_owner: p.user_id === me(),
    can_delete:
      p.user_id === me() ||
      (!!p.group_id && group(p.group_id).creator_id === me()),
    viewer_ids: p.user_id === me() ? p.viewer_ids : undefined,
  };
}
function viewGroup(g: ApiGroup): ApiGroup {
  const s = getDemoState();
  return {
    ...g,
    creator_username: user(g.creator_id).username,
    member_count: s.memberships.filter((m) => m.groupId === g.id).length,
    membership_role: member(g.id)?.role,
    has_pending_join_request: s.joinRequests.some(
      (r) => r.groupId === g.id && r.userId === me(),
    ),
    has_pending_invitation: s.invitations.some(
      (i) => i.groupId === g.id && i.to === me(),
    ),
  };
}
function viewEvent(e: ApiEvent): ApiEvent {
  const r = getDemoState().rsvps[e.id] ?? {};
  return {
    ...e,
    current_user_response: r[me()] ?? null,
    going_count: Object.values(r).filter((x) => x === "going").length,
    not_going_count: Object.values(r).filter((x) => x === "not_going").length,
  };
}
function profile(id: number) {
  const u = user(id),
    can = id === me() || !u.is_private || follows(me(), id);
  return {
    ...u,
    can_view_full_profile: can,
    about_me: can ? u.about_me : "",
    email: id === me() ? u.email : "",
    date_of_birth: can ? u.date_of_birth : "",
    created_at: SEED_DATE,
    updated_at: SEED_DATE,
  };
}
function eligible(id: number) {
  return id !== me() && (follows(me(), id) || follows(id, me()));
}
function addMember(groupId: number, userId: number) {
  if (!member(groupId, userId))
    getDemoState().memberships.push({ groupId, userId, role: "member" });
}
function notify(
  userId: number,
  type: string,
  entityId: number,
  message: string,
  actor = me(),
  groupId?: number,
) {
  const s = getDemoState();
  const n = {
    id: s.nextId++,
    userId,
    actor_id: actor,
    type,
    entity_id: entityId,
    entity_type: groupId ? "group" : "post",
    message,
    created_at: now(),
    read_at: null,
    data: {
      actor_username: user(actor).username,
      ...(groupId
        ? { group_id: groupId, group_title: group(groupId).title }
        : {}),
    },
  };
  s.notifications.unshift(n);
  if (userId === me()) emit("notification", n);
}
async function bodyValues(
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const body = init?.body;
  if (body instanceof FormData) {
    const result: Record<string, unknown> = {};
    for (const key of new Set(body.keys())) {
      const values = await Promise.all(
        body.getAll(key).map(async (v) => {
          if (typeof v === "string") return v;
          // Keep uploads local and bounded; data URLs survive reload and export hosting.
          if (v.size > 1024 * 1024)
            fail(
              "Demo attachments must be 1 MB or smaller to fit browser storage.",
              400,
            );
          return await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = reject;
            r.readAsDataURL(v);
          });
        }),
      );
      result[key] =
        key === "media" || key === "viewer_ids" ? values : values[0];
    }
    return result;
  }
  return typeof body === "string" ? JSON.parse(body) : {};
}

export async function demoRequest(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const s = getDemoState(),
    method = init?.method ?? "GET",
    b = await bodyValues(init),
    url = new URL(path, "https://demo.invalid");
  const p = url.pathname.replace(/^\/api/, "").replace(/\/$/, ""),
    q = url.searchParams,
    parts = p.split("/").filter(Boolean);
  const id = Number(parts[1]),
    action = parts[2],
    subId = Number(parts[3]);
  const ok = { success: true };
  let result: unknown;
  if (p === "/login") {
    const u = user(me());
    result = { ...u, user_id: u.id, message: "Interactive demo identity" };
  } else if (p === "/logout") result = ok;
  else if (p === "/register")
    fail(
      "Registration is not needed. Choose a fictional identity from Demo controls.",
      400,
    );
  else if (p === "/users/me/password")
    fail(
      "Demo identities have no passwords. No credentials are stored or changed.",
      400,
    );
  else if (p.startsWith("/users/me")) {
    const u = user(me());
    if (method !== "GET") {
      if (p.endsWith("/privacy")) u.is_private = Boolean(b.is_private);
      if (p.endsWith("/profile"))
        for (const key of [
          "first_name",
          "last_name",
          "nickname",
          "about_me",
          "date_of_birth",
        ] as const)
          u[key] = String(b[key] ?? "");
      if (p.endsWith("/avatar"))
        u.profile_photo = b.remove_photo
          ? ""
          : String(b.profilePhoto ?? u.profile_photo);
    }
    result = { ...ok, profile: profile(me()), is_private: u.is_private };
  } else if (parts[0] === "profiles") {
    const u =
      s.users.find((u) => u.username === decodeURIComponent(parts[1])) ??
      fail("Demo profile not found", 404);
    if (action === "follow") {
      if (u.id === me()) fail("You already have your own orbit.", 400);
      if (method === "DELETE") {
        s.follows = s.follows.filter((f) => !(f[0] === me() && f[1] === u.id));
        s.followRequests = s.followRequests.filter(
          (r) => !(r.from === me() && r.to === u.id),
        );
      } else if (!follows(me(), u.id)) {
        if (u.is_private) {
          if (!s.followRequests.some((r) => r.from === me() && r.to === u.id)) {
            const rid = s.nextId++;
            s.followRequests.push({ id: rid, from: me(), to: u.id });
            notify(
              u.id,
              "follow_request",
              rid,
              "requested to follow your private orbit.",
            );
          }
        } else {
          s.follows.push([me(), u.id]);
          notify(u.id, "new_follower", me(), "is now following your orbit.");
        }
      }
      result = ok;
    } else if (action === "follow-status")
      result = {
        ...ok,
        is_following: follows(me(), u.id),
        has_pending_request: s.followRequests.some(
          (r) => r.from === me() && r.to === u.id,
        ),
      };
    else if (action === "followers" || action === "following") {
      const can = profile(u.id).can_view_full_profile;
      result = {
        ...ok,
        users: can
          ? s.follows
              .filter((f) => f[action === "followers" ? 1 : 0] === u.id)
              .map((f) => user(f[action === "followers" ? 0 : 1]))
          : [],
      };
    } else result = { ...ok, profile: profile(u.id) };
  } else if (parts[0] === "follow-requests") {
    if (method === "GET")
      result = {
        ...ok,
        requests: s.followRequests
          .filter((r) => r.to === me())
          .map((r) => ({
            id: r.id,
            requester: user(r.from),
            status: "pending",
            created_at: SEED_DATE,
            updated_at: SEED_DATE,
          })),
      };
    else {
      const r =
        s.followRequests.find((r) => r.id === id && r.to === me()) ??
        fail("Follow request no longer pending", 404);
      if (action === "accept") {
        s.follows.push([r.from, r.to]);
        notify(
          r.from,
          "follow_accepted",
          me(),
          "accepted your follow request.",
        );
      }
      s.followRequests = s.followRequests.filter((x) => x.id !== id);
      result = ok;
    }
  } else if (p === "/users/recommendations")
    result = s.users
      .filter((u) => u.id !== me() && !follows(me(), u.id))
      .slice(0, Number(q.get("limit") ?? 4))
      .map((u) => {
        const mutual = s.users.filter(
          (v) => follows(me(), v.id) && follows(v.id, u.id),
        );
        return {
          id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          username: u.username,
          avatarUrl: u.profile_photo,
          mutualCount: mutual.length,
          mutualPreview: mutual.slice(0, 2).map((v) => v.username),
          isFollowing: false,
          hasPendingRequest: s.followRequests.some(
            (r) => r.from === me() && r.to === u.id,
          ),
        };
      });
  else if (
    parts[0] === "posts" ||
    (parts[0] === "groups" && action === "posts")
  ) {
    const groupId = parts[0] === "groups" ? id : undefined;
    if (groupId) requireMember(groupId);
    if (!parts[1] || groupId) {
      if (method === "POST") {
        const u = user(me());
        const pid = s.nextId++;
        const media = (
          Array.isArray(b.media) ? b.media : b.image ? [b.image] : []
        ).map((x, i) => ({
          id: pid * 10 + i,
          url: String(x),
          type: "image" as const,
          order: i,
        }));
        const created: Post = {
          id: pid,
          user_id: me(),
          author: u,
          title: String(b.title ?? ""),
          content: String(b.content ?? ""),
          visibility: (b.visibility ?? "public") as Post["visibility"],
          viewer_ids: (Array.isArray(b.viewer_ids) ? b.viewer_ids : []).map(
            Number,
          ),
          media,
          created_at: now(),
          updated_at: now(),
          is_owner: true,
          can_delete: true,
          ...(groupId
            ? { group_id: groupId, group_title: group(groupId).title }
            : {}),
        };
        s.posts.unshift(created);
        result = viewPost(created);
      } else {
        let posts = s.posts
          .filter(visible)
          .filter((p) => (groupId ? p.group_id === groupId : !p.group_id));
        if (q.get("feed") === "following")
          posts = posts.filter((p) => follows(me(), p.user_id));
        if (q.get("feed") === "friends")
          posts = posts.filter(
            (p) => follows(me(), p.user_id) && follows(p.user_id, me()),
          );
        if (q.has("before"))
          posts = posts.filter(
            (p) =>
              p.created_at < q.get("before")! ||
              (p.created_at === q.get("before") &&
                p.id < Number(q.get("before_id"))),
          );
        result = posts.slice(0, Number(q.get("limit") ?? 1000)).map(viewPost);
      }
    } else {
      const item = post(id);
      if (action === "likes") {
        let ids = s.likes[id] ?? [];
        if (method === "POST" && !ids.includes(me())) {
          ids = [...ids, me()];
          notify(item.user_id, "post_like", id, "liked your post.");
        }
        if (method === "DELETE") ids = ids.filter((x) => x !== me());
        s.likes[id] = ids;
        result = { post_id: id, count: ids.length, liked: ids.includes(me()) };
      } else if (action === "comments") {
        if (parts[3] === "count")
          result = {
            post_id: id,
            count: s.comments.filter((c) => c.post_id === id).length,
          };
        else if (method === "POST") {
          const c = {
            id: s.nextId++,
            post_id: id,
            user_id: me(),
            author: user(me()),
            content: String(b.content ?? ""),
            image_url: b.image ? String(b.image) : undefined,
            created_at: now(),
            updated_at: now(),
            is_owner: true,
            can_delete: true,
          };
          s.comments.push(c);
          notify(item.user_id, "post_comment", id, "commented on your post.");
          result = c;
        } else
          result = s.comments
            .filter((c) => c.post_id === id)
            .map((c) => ({
              ...c,
              author: user(c.user_id),
              is_owner: c.user_id === me(),
              can_delete: c.user_id === me() || item.user_id === me(),
            }));
      } else if (action === "share") {
        const target = Number(b.target_id);
        if (b.target === "group") requireMember(target);
        else if (b.target !== "user" || !eligible(target))
          fail("Choose an eligible conversation to share this post.");
        const link = `/posts/${id}`;
        sendDemoEvent(
          b.target === "group" ? "group_message" : "private_message",
          {
            group_id: target,
            recipient_id: target,
            content: `${b.message ? `${b.message}\n` : ""}${link}`,
          },
        );
        result = { post_id: id, target: b.target, link: postHref(id) };
      } else if (method === "PUT") {
        if (item.user_id !== me()) fail("Only the author can edit this post.");
        Object.assign(item, {
          title: String(b.title),
          content: String(b.content),
          visibility: b.visibility,
          viewer_ids: b.viewer_ids,
          updated_at: now(),
        });
        result = ok;
      } else if (method === "DELETE") {
        if (!viewPost(item).can_delete) fail("You cannot delete this post.");
        s.posts = s.posts.filter((p) => p.id !== id);
        s.comments = s.comments.filter((c) => c.post_id !== id);
        result = ok;
      } else result = viewPost(item);
    }
  } else if (parts[0] === "comments") {
    const c =
      s.comments.find((c) => c.id === id) ?? fail("Comment not found", 404);
    const p = post(c.post_id);
    if (c.user_id !== me() && p.user_id !== me())
      fail("You cannot delete this comment.");
    s.comments = s.comments.filter((c) => c.id !== id);
    result = ok;
  } else if (parts[0] === "groups") {
    if (parts[1] === "recommendations")
      result = s.groups
        .filter(
          (g) =>
            g.privacy === "public" &&
            !member(g.id) &&
            !viewGroup(g).has_pending_join_request,
        )
        .slice(0, 3)
        .map((g) => {
          const mutual = s.memberships.filter(
            (m) => m.groupId === g.id && follows(me(), m.userId),
          );
          return {
            id: g.id,
            name: g.title,
            slug: String(g.id),
            avatarUrl: g.group_photo ?? "",
            memberCount: viewGroup(g).member_count,
            mutualMemberCount: mutual.length,
            mutualMemberPreview: mutual
              .slice(0, 2)
              .map((m) => user(m.userId).username),
            requiresApproval: true,
          };
        });
    else if (!parts[1] || parts[1] === "mine") {
      if (method === "POST") {
        const gid = s.nextId++;
        s.groups.push({
          id: gid,
          creator_id: me(),
          creator_username: user(me()).username,
          title: String(b.title),
          description: String(b.description),
          privacy: b.privacy as ApiGroup["privacy"],
          group_photo: String(
            b.groupPhoto ??
              (b.image_template_id
                ? assetPath(`/image/templets/${b.image_template_id}.png`)
                : ""),
          ),
          member_count: 1,
          created_at: now(),
          updated_at: now(),
          has_pending_invitation: false,
          has_pending_join_request: false,
        });
        s.memberships.push({ groupId: gid, userId: me(), role: "creator" });
        result = { ...ok, group_id: gid };
      } else {
        const search = (q.get("search") ?? "").toLowerCase();
        result = {
          ...ok,
          groups: s.groups
            .filter(
              (g) =>
                (parts[1] === "mine"
                  ? !!member(g.id)
                  : g.privacy === "public") &&
                `${g.title} ${g.description}`.toLowerCase().includes(search),
            )
            .slice(
              Number(q.get("offset") ?? 0),
              Number(q.get("offset") ?? 0) + Number(q.get("limit") ?? 20),
            )
            .map(viewGroup),
        };
      }
    } else {
      const g = group(id);
      if (action === "membership")
        result = {
          ...ok,
          is_member: !!member(id),
          role: member(id)?.role,
          has_pending_join_request: viewGroup(g).has_pending_join_request,
        };
      else if (action === "members") {
        requireMember(id);
        if (method === "DELETE") {
          if (subId !== me()) requireCreator(id);
          if (subId === g.creator_id)
            fail("Creators can delete their group from settings.");
          s.memberships = s.memberships.filter(
            (m) => !(m.groupId === id && m.userId === subId),
          );
          result = ok;
        } else
          result = {
            ...ok,
            members: s.memberships
              .filter((m) => m.groupId === id)
              .map((m) => ({
                ...user(m.userId),
                user_id: m.userId,
                role: m.role,
                joined_at: SEED_DATE,
                avatar: user(m.userId).profile_photo,
              })),
          };
      } else if (action === "join-requests") {
        if (method === "GET") {
          requireCreator(id);
          result = {
            ...ok,
            join_requests: s.joinRequests
              .filter((r) => r.groupId === id)
              .map((r) => ({
                id: r.id,
                group_id: id,
                user_id: r.userId,
                username: user(r.userId).username,
                status: "pending",
                created_at: SEED_DATE,
                updated_at: SEED_DATE,
              })),
          };
        } else if (subId) {
          requireCreator(id);
          const r =
            s.joinRequests.find((r) => r.id === subId && r.groupId === id) ??
            fail("Request no longer pending", 404);
          if (parts[4] === "accept") addMember(id, r.userId);
          notify(
            r.userId,
            parts[4] === "accept"
              ? "group_join_accepted"
              : "group_join_rejected",
            id,
            parts[4] === "accept"
              ? "accepted your join request."
              : "declined your join request.",
            me(),
            id,
          );
          s.joinRequests = s.joinRequests.filter((r) => r.id !== subId);
          result = ok;
        } else {
          if (method === "DELETE")
            s.joinRequests = s.joinRequests.filter(
              (r) => !(r.groupId === id && r.userId === me()),
            );
          else {
            if (g.privacy === "private")
              fail("Private communities require an invitation.");
            if (!member(id) && !viewGroup(g).has_pending_join_request) {
              const rid = s.nextId++;
              s.joinRequests.push({ id: rid, groupId: id, userId: me() });
              notify(
                g.creator_id,
                "group_join_request",
                rid,
                "requested to join your community.",
                me(),
                id,
              );
            }
          }
          result = ok;
        }
      } else if (action === "invitations") {
        requireMember(id);
        const to = Number(b.invited_user_id);
        user(to);
        if (
          !member(id, to) &&
          !s.invitations.some((i) => i.groupId === id && i.to === to)
        ) {
          const iid = s.nextId++;
          s.invitations.push({ id: iid, groupId: id, from: me(), to });
          notify(
            to,
            "group_invitation",
            iid,
            "invited you to a community.",
            me(),
            id,
          );
        }
        result = ok;
      } else if (action === "events") {
        requireMember(id);
        if (parts[4] === "response") {
          const e =
            s.events.find((e) => e.id === subId && e.group_id === id) ??
            fail("Event not found", 404);
          if (b.response !== "going" && b.response !== "not_going")
            fail("Choose Going or Not Going", 400);
          (s.rsvps[e.id] ??= {})[me()] = b.response as "going" | "not_going";
          emit("group_event_response_updated", {
            group_id: id,
            event_id: e.id,
            user_id: me(),
            response: b.response,
          });
          result = { ...ok, event: viewEvent(e) };
        } else if (parts[4] === "responses")
          result = {
            ...ok,
            responses: Object.entries(s.rsvps[subId] ?? {}).map(
              ([uid, response]) => ({
                user_id: Number(uid),
                username: user(Number(uid)).username,
                avatar: user(Number(uid)).profile_photo,
                response,
              }),
            ),
          };
        else if (method === "POST") {
          const eid = s.nextId++;
          s.events.push({
            id: eid,
            group_id: id,
            created_by: me(),
            title: String(b.title),
            description: String(b.description),
            event_time: String(b.event_time),
            created_at: now(),
            updated_at: now(),
            current_user_response: null,
            going_count: 0,
            not_going_count: 0,
            image_path: b.image
              ? String(b.image)
              : b.cover_template
                ? String(b.cover_template)
                : null,
          });
          result = { ...ok, event_id: eid };
        } else
          result = {
            ...ok,
            events: s.events.filter((e) => e.group_id === id).map(viewEvent),
          };
      } else if (action === "messages") {
        requireMember(id);
        const history = s.groupMessages.filter((m) => m.group_id === id);
        const offset = Number(q.get("offset") ?? 0),
          limit = Number(q.get("limit") ?? 20);
        result = history.slice(
          Math.max(0, history.length - offset - limit),
          history.length - offset,
        );
      } else if (method === "PUT") {
        requireCreator(id);
        g.title = String(b.title);
        g.description = String(b.description);
        if (b.groupPhoto) g.group_photo = String(b.groupPhoto);
        if (b.remove_photo) g.group_photo = "";
        result = { ...ok, group: viewGroup(g) };
      } else if (method === "DELETE") {
        requireCreator(id);
        s.groups = s.groups.filter((g) => g.id !== id);
        s.memberships = s.memberships.filter((m) => m.groupId !== id);
        s.events = s.events.filter((e) => e.group_id !== id);
        const deletedPosts = new Set(
          s.posts.filter((p) => p.group_id === id).map((p) => p.id),
        );
        s.posts = s.posts.filter((p) => p.group_id !== id);
        s.comments = s.comments.filter((c) => !deletedPosts.has(c.post_id));
        s.groupMessages = s.groupMessages.filter((m) => m.group_id !== id);
        s.invitations = s.invitations.filter((i) => i.groupId !== id);
        s.joinRequests = s.joinRequests.filter((r) => r.groupId !== id);
        result = ok;
      } else result = { ...ok, group: viewGroup(g) };
    }
  } else if (parts[0] === "group-invitations") {
    if (method === "GET")
      result = {
        ...ok,
        invitations: s.invitations
          .filter((i) => i.to === me())
          .map((i) => ({
            id: i.id,
            group_id: i.groupId,
            invited_by: i.from,
            invited_user_id: i.to,
            status: "pending",
            created_at: SEED_DATE,
            updated_at: SEED_DATE,
            group_title: group(i.groupId).title,
            group_privacy: group(i.groupId).privacy,
            inviter_username: user(i.from).username,
          })),
      };
    else {
      const i =
        s.invitations.find((i) => i.id === id && i.to === me()) ??
        fail("Invitation no longer pending", 404);
      if (action === "accept") addMember(i.groupId, me());
      notify(
        i.from,
        action === "accept"
          ? "group_invitation_accepted"
          : "group_invitation_declined",
        i.groupId,
        action === "accept"
          ? "accepted your group invitation."
          : "declined your group invitation.",
        me(),
        i.groupId,
      );
      s.invitations = s.invitations.filter((x) => x.id !== id);
      result = ok;
    }
  } else if (p.startsWith("/chat/")) {
    if (p.endsWith("/eligible-contacts"))
      result = s.users
        .filter(
          (u) =>
            eligible(u.id) &&
            (!q.get("contact_id") || u.id === Number(q.get("contact_id"))) &&
            `${u.username} ${u.first_name} ${u.last_name}`
              .toLowerCase()
              .includes((q.get("search") ?? "").toLowerCase()),
        )
        .slice(
          Number(q.get("offset") ?? 0),
          Number(q.get("offset") ?? 0) + Number(q.get("limit") ?? 20),
        );
    else if (p.endsWith("/history")) {
      const uid = Number(q.get("user_id"));
      const history = s.messages.filter(
        (m) =>
          (m.sender_id === me() && m.recipient_id === uid) ||
          (m.recipient_id === me() && m.sender_id === uid),
      );
      const offset = Number(q.get("offset") ?? 0),
        limit = Number(q.get("limit") ?? 20);
      result = history.slice(
        Math.max(0, history.length - offset - limit),
        history.length - offset,
      );
    } else {
      const partners = new Set(
        s.messages
          .filter((m) => m.sender_id === me() || m.recipient_id === me())
          .map((m) => (m.sender_id === me() ? m.recipient_id : m.sender_id)),
      );
      result = [...partners]
        .map((id) => {
          const u = user(id),
            history = s.messages.filter(
              (m) =>
                (m.sender_id === me() && m.recipient_id === id) ||
                (m.sender_id === id && m.recipient_id === me()),
            ),
            last = history[history.length - 1];
          return {
            partner_id: id,
            partner_username: u.username,
            partner_first_name: u.first_name,
            partner_last_name: u.last_name,
            partner_avatar: u.profile_photo,
            last_message: last.content,
            last_message_at: last.created_at,
            last_message_from_me: last.sender_id === me(),
            unread_count: history.filter(
              (m) => m.recipient_id === me() && !m.read_at,
            ).length,
          };
        })
        .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
    }
  } else if (parts[0] === "notifications") {
    const notifications = s.notifications.filter((n) => n.userId === me());
    if (parts[1] === "unread-count")
      result = { count: notifications.filter((n) => !n.read_at).length };
    else if (method !== "GET") {
      notifications
        .filter((n) => parts[1] === "read-all" || n.id === id)
        .forEach((n) => {
          n.read_at = now();
        });
      result = ok;
    } else
      result = {
        notifications: notifications.slice(
          Number(q.get("offset") ?? 0),
          Number(q.get("offset") ?? 0) + Number(q.get("limit") ?? 50),
        ),
      };
  } else if (p === "/search") {
    const query = q.get("q") ?? "",
      term = query.toLowerCase(),
      type = q.get("type") ?? "all",
      matches = (text: string) => text.toLowerCase().includes(term),
      limit = Number(q.get("limit") ?? 10);
    result = {
      query,
      users:
        type === "all" || type === "users"
          ? s.users
              .filter((u) =>
                matches(`${u.username} ${u.first_name} ${u.last_name}`),
              )
              .slice(0, limit)
              .map((u) => ({ ...u, is_following: follows(me(), u.id) }))
          : [],
      groups:
        type === "all" || type === "groups"
          ? s.groups
              .filter(
                (g) =>
                  (g.privacy === "public" || member(g.id)) &&
                  matches(`${g.title} ${g.description}`),
              )
              .slice(0, limit)
              .map(viewGroup)
          : [],
      posts:
        type === "all" || type === "posts"
          ? s.posts
              .filter((p) => visible(p) && matches(`${p.title} ${p.content}`))
              .slice(0, limit)
              .map((p) => ({
                id: p.id,
                title: p.title,
                content_snippet: p.content,
                author_id: p.user_id,
                author_username: user(p.user_id).username,
                author_photo: user(p.user_id).profile_photo,
                group_id: p.group_id,
                group_title: p.group_title,
                created_at: p.created_at,
              }))
          : [],
      events:
        type === "all" || type === "events"
          ? s.events
              .filter((e) => !!member(e.group_id) && matches(e.title))
              .slice(0, limit)
              .map((e) => ({ ...e, group_title: group(e.group_id).title }))
          : [],
    };
  } else
    fail(
      `This capability is unavailable in the local demo (${method} ${p}).`,
      404,
    );
  if (method !== "GET") saveDemo();
  return structuredClone(result);
}

/** Used by the few existing feature clients that consume raw Response envelopes. */
export async function requestFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  if (!DEMO_MODE) return fetch(input, init);
  try {
    return Response.json(
      await demoRequest(
        new URL(input, "https://demo.invalid").pathname +
          new URL(input, "https://demo.invalid").search,
        init,
      ),
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    const status = error instanceof ApiError ? error.status : 400;
    const message =
      error instanceof Error ? error.message : "Demo request failed";
    return Response.json(
      { success: false, message, error: message },
      { status: status || 400 },
    );
  }
}

export function sendDemoEvent(type: EventType, payload: unknown) {
  const s = getDemoState(),
    b = payload as Record<string, unknown>,
    u = user(me());
  try {
    if (type === "private_message") {
      const target = Number(b.recipient_id);
      if (!eligible(target))
        fail("You can only message users you follow or who follow you.");
      const message: PrivateMessage = {
        id: s.nextId++,
        sender_id: me(),
        recipient_id: target,
        sender_username: u.username,
        sender_first_name: u.first_name,
        sender_last_name: u.last_name,
        sender_avatar: u.profile_photo,
        content: String(b.content).trim(),
        created_at: now(),
      };
      if (!message.content) return;
      s.messages.push(message);
      emit(type, message);
      notify(target, "private_message", me(), "sent you a demo message.");
    } else if (type === "group_message") {
      const gid = Number(b.group_id);
      requireMember(gid);
      const message: GroupMessagePayload = {
        id: s.nextId++,
        group_id: gid,
        user_id: me(),
        username: u.username,
        first_name: u.first_name,
        last_name: u.last_name,
        avatar: u.profile_photo,
        content: String(b.content).trim(),
        created_at: now(),
      };
      if (!message.content) return;
      s.groupMessages.push(message);
      emit(type, message);
    } else if (type === "mark_read")
      s.messages
        .filter(
          (m) => m.sender_id === Number(b.sender_id) && m.recipient_id === me(),
        )
        .forEach((m) => {
          m.read_at = now();
        });
    else if (type === "invite_user_search")
      emit("invite_user_search_results", {
        request_id: b.request_id,
        group_id: b.group_id,
        users: s.users
          .filter(
            (u) =>
              !member(Number(b.group_id), u.id) &&
              `${u.username} ${u.first_name}`
                .toLowerCase()
                .includes(String(b.query).toLowerCase()),
          )
          .slice(0, 10)
          .map((u) => ({ ...u, avatar: u.profile_photo })),
      });
    saveDemo();
  } catch (error) {
    emit("error", {
      message: error instanceof Error ? error.message : "Demo action failed",
    });
  }
}
