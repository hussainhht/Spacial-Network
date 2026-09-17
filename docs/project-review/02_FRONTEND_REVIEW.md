# 02 — Frontend Review

> Scope: `frontend/src/` excluding `components/space/` internals (see `07_3D_SPACE_PERFORMANCE_REVIEW.md`) and the WebSocket provider's realtime state-sync logic (see `06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md`). Covers architecture, React/Next.js correctness, data fetching, forms, responsive CSS, and accessibility. All findings verified by reading the actual component code, not inferred from file names.

## Overall Assessment

The frontend is **unusually well engineered** for its apparent scale: real `AbortController` usage with stale-response guarding in search, correct optimistic-update-with-rollback for likes and follows, a race-safe module-level resource cache for groups, thorough cancellation/error handling in data-fetching hooks, and generally solid accessibility scaffolding (focus traps, `aria-live` regions, labelled controls) in the primary modal implementation. The most important finding in this file — and arguably in the whole audit — is a genuine, high-impact bug in the custom-audience post picker that directly explains a bug the project's own developer flagged in `TODO.md`.

---

## 1. The Custom/Private Post Picker — Priority Investigation

**TODO.md claim under investigation:** *"privet post is not work there is not selct people so i can add them."*

### FE-001 — A `custom`-visibility post can be submitted with zero selected recipients, silently producing a post visible to nobody

**Severity:** High · **Confidence:** High

**What the picker actually does (confirmed correct by design, not a bug):** `useMyFollowers.ts` fetches the current user's own **followers** (people who follow *you*) via `GET /profiles/{username}/followers`. This is not a frontend mistake — it mirrors real backend enforcement: `posts/service.go`'s `CreatePost` intersects any submitted `viewer_ids` with the author's actual follower list before persisting, and `ListPosts`'s custom-visibility clause requires a viewer to be **both** on the allowed-viewers list **and** a current follower to ever see the post. A "custom" post's addressable audience is, by backend design, a subset of the author's followers — offering only followers as pickable candidates is correct scope, not a bug.

**Confirmed accurate (matches the prior Gemini audit's characterization):** `CustomViewerPicker.tsx:32-38` shows, for zero followers, only *"You don't have any followers to choose from yet"* — no link to find people, no explanation that the restriction is "followers only." A user with zero followers, or who doesn't realize the "Specific people" option is followers-scoped, will reasonably conclude the feature "doesn't work."

**The deeper, previously-unreported bug:** Nothing in the client blocks submitting a `visibility: "custom"` post with an **empty** `viewerIds` array. Neither `NewPostForm.tsx`'s `handleSubmit` nor `PostForm.tsx`'s `handleSubmit` checks `viewerIds.length > 0` before calling `createPost`/`onSubmit`; the submit button is only disabled while `loading`, never for an empty custom-audience selection. The backend doesn't catch it either: `backend/internal/posts/validation.go`'s `ValidateNewPostRequest`/`ValidateEditPostRequest` only validates `Title`, `Content`, and that `Visibility` is a recognized enum value — `ViewerIDs` non-emptiness is never checked.

**Consequence:** a user selects "Selected/Specific people," submits without picking anyone (whether the list was empty, they forgot, or they didn't understand the followers-only scope), and the app reports success (`"Post published."` toast, redirect to `/`). The post is created with an **empty** `post_allowed_viewers` set, so by the documented visibility rule it is visible to **no one except the author — permanently, with zero warning anywhere in the flow.** This is a materially worse failure mode than a hard error: the UI actively confirms success for a post that functionally doesn't exist for anyone else. This is a far more complete and more plausible explanation for the developer's own "private post is not work[ing]" complaint than the empty-follower-list state alone.

**Recommended fix:**
1. Client: block submission (disable submit, show inline error) when `visibility === "custom" && viewerIds.length === 0`, in both `NewPostForm.tsx` and `PostForm.tsx`.
2. Server: mirror the same rule in `ValidateNewPostRequest`/`ValidateEditPostRequest` as defense in depth (the frontend brief for this project explicitly states business logic must live on the backend — see `docs/BUSINESS_LOGIC.md`).
3. UX: make the followers-only scope explicit in the picker/empty-state copy instead of the current bare, unexplained sentence.

**Requirement impact:** this fails the "Almost Private / Private post selects specific followers" requirement from `docs/TODO/02_posts_comments.md` — see `01_REQUIREMENTS_COMPLIANCE.md`.

---

## 2. Architecture

### Info — App Router used almost entirely as a client-rendered SPA

Every route segment checked is either a thin server wrapper around a `"use client"` tree or itself client-only; all data (`useFeed`, `useGroupData`, notifications, search) is fetched from `useEffect`/`useSyncExternalStore` after mount, with no Server Components/streaming used for data. Legitimate for a 3D/WebSocket-heavy app, but it means no real SSR benefit (first paint is loading skeletons on nearly every page) and hydration-mismatch risk is largely moot today since no real data exists at the SSR pass. Flagging as a deliberate tradeoff future contributors should know about, not a defect.

### FE-004 — Duplicated, inconsistent modal implementations

**Severity:** Low-Medium · **Confidence:** High

`components/ConfirmDialog.tsx` is a well-built, reusable confirmation dialog (focus trap, scroll lock, initial focus, focus restore, Escape). Despite this existing, two destructive-action dialogs were hand-rolled from scratch with materially weaker implementations instead of reusing it — `GroupPanels.tsx`'s `RemoveMemberDialog` and `GroupDangerZone.tsx`'s `DeleteGroupDialog` — plus bespoke implementations in `ShareModal.tsx`, `GroupInviteModal.tsx`, and `GroupChatInfoSheet.tsx`. This is both a duplication issue and the direct cause of the accessibility gap in `FE-003` below. **Fix:** consolidate on `ConfirmDialog` (it already accepts `children` for custom body content).

### FE-005 — Module-scoped group-data cache is not tied to auth/session lifecycle

**Severity:** Low · **Confidence:** High

`features/groups/hooks/useGroupData.ts` implements a `resources: Map<string, Resource<unknown>>` module-level cache shared app-wide via `useSyncExternalStore`, keyed by strings like `group:{id}:details`. It is well-built (revision counters correctly discard superseded in-flight reloads; entries evict on last-subscriber-unmount), but has no concept of "which user" the cached data belongs to, and logout (`useLogout.ts`) navigates via `router.replace("/login")` — a client-side navigation, not a full reload — with nothing explicitly clearing this module state. Currently safe only because navigating from `(main)` to `(auth)/login` unmounts the entire layout tree, dropping every subscriber and evicting every entry before a different user could reuse the tab — a fragile, implicit invariant that would break if a persistent, layout-independent subscriber is ever added. **Fix:** clear `resources` explicitly in `useLogout`, or key entries by user id.

### Info — Cross-feature coupling, no cycles

`posts`↔`interactions`, `posts`↔`profile`, `groups`↔`posts` all reach directly into each other's `api/`/`components/` (each pair one-directional, confirmed no actual import cycle). Not a bug today, but will make extracting any one feature in isolation progressively harder as the app grows.

### Positive patterns worth preserving (Info)

- `useFeed.ts` adjusts state during render (per documented React guidance) when the `feed` prop changes, avoiding a flash of the previous filter's results.
- `InteractionsBar`/`PostCard.tsx` uses a deliberate, JSDoc-documented `key`-based remount as a correct alternative to a prop-syncing effect.
- No genuinely dead component/hook/util files found in a systematic reference sweep (excluding framework-loaded `app/**` files, correctly excluded).

---

## 3. React/Next.js Correctness

### Info — `useState(Date.now)` in `EventCountdown.tsx` is a hydration-fragile pattern, not currently exploitable

Initializing state from `Date.now()` is the canonical SSR/hydration-mismatch trap. Not currently exploitable: `EventCountdown` only receives real data after the client-only data hook resolves (per §2's SPA architecture), so it never actually paints during the SSR pass. Flagging as fragile-if-reused rather than an active bug.

### Info — `suppressHydrationWarning` used correctly and deliberately elsewhere

`PostCard.tsx` renders relative post time inside `<time suppressHydrationWarning>`, correctly anticipating the same class of bug — moot today for the same SPA-architecture reason, but worth knowing if SSR is ever added to the feed.

### Info — No unstable list keys found

The only `key={index}` usages found are on genuinely static/order-stable content (a decorative SVG ring, two loading-skeleton grids). Feed, comments, chat, and group lists all key by stable server ids.

---

## 4. Data Fetching

Overall strong, with concrete positive evidence: `useFeed.ts` (cancellation via a `cancelled` flag, 401 handled distinctly, dedup by id set, retry path), `useUniversalSearch.ts` (real `AbortController`, aborts on every dependency change, **and** additionally gates rendered results with a `resultKey` check so even a response that races past the abort can't clobber a newer query), `ShareModal.tsx` (debounced search, `isMounted` guard, prior timer always cleared before the next fires), like/follow buttons (correct optimistic update with rollback on rejection, `pending` flag prevents double-toggle), `PostFeed.tsx`'s infinite scroll (`IntersectionObserver` correctly re-created only on real dependency changes, does not observe mid-load or mid-error).

See `FE-001` above (§1) for the one data-fetching-adjacent gap of real consequence — the custom-post-picker submission validation.

---

## 5. Forms

- **Registration wizard**: per-step validation reasonably mirrors backend rules. Server error messages are mapped back to the correct wizard step by keyword-sniffing the message text (`resolveErrorStep`) since the backend returns plain-English errors with no field/error codes — functional but brittle: a backend copy change would silently break step-routing with no compile-time signal. Low/Info; worth a shared error-code contract if the backend auth handler is touched again. Avatar file type/size is validated client-side before upload; submit correctly disabled while in-flight/after success.
- **FE-007** (Low): Login/Register cross-links use `<a href>` instead of `next/link` (`LoginForm.tsx`, `RegisterForm.tsx`), forcing a full page reload where the rest of the app consistently uses client-side navigation.
- **Positive**: Login sanitizes the `?next=` redirect param against protocol-relative redirects before use — correct open-redirect guard.
- **Settings forms**: thorough field-level validation (length, byte-length for bcrypt's 72-byte limit, confirm-match), busy-state guards on every mutation, consistent `aria-invalid`/`aria-describedby`/`role="alert"` wiring.
- **Comment/post composers**: both validate image type/size via the shared `lib/upload.ts` `validateImageFile` before upload, both disable submit while in-flight, both revoke `URL.createObjectURL` blobs on unmount/replacement — no blob URL leaks found.

---

## 6. Responsive UI

Breakpoint coverage is broad and mostly correct — e.g. `Chat.module.css` collapses the two-pane layout below 960px and bumps input font-size to 16px on mobile specifically to prevent iOS Safari's auto-zoom-on-focus (a detail many apps miss); `NewPostForm.module.css` collapses the composer/preview grid appropriately at 1050px/620px.

### FE-006 — `.group-member-name` uses `text-overflow: ellipsis` without `white-space: nowrap`, so truncation has no effect

**Severity:** Low · **Confidence:** High

`app/globals.css:1602-1608` sets `overflow: hidden; text-overflow: ellipsis;` with no `white-space: nowrap`. Without it, the browser default (`white-space: normal`) lets long names wrap onto a second line instead of being truncated, potentially misaligning the group-member row (avatar/name/role) at narrow widths. Contrast with `TopNavbar.module.css`'s `.contextTitle`, which correctly pairs all three properties. **Fix:** add `white-space: nowrap;`.

No other hardcoded-pixel-width overflow traps, nested competing scroll containers, or viewport-unit assumptions that would break at small viewports were found in the chat/feed/profile CSS modules checked.

---

## 7. Accessibility

### FE-003 — Inconsistent focus management across modals; the two weakest examples guard the most destructive actions

**Severity:** Medium · **Confidence:** High

`ConfirmDialog.tsx` implements the full accessible-dialog contract (initial focus, Tab-trap, Escape-close, scroll lock, focus-restore on close) — and `ShareModal.tsx`/`GroupInviteModal.tsx` match it. But `RemoveMemberDialog` (`GroupPanels.tsx`) and `DeleteGroupDialog` (`GroupDangerZone.tsx`) only handle `Escape` — no initial focus, no Tab-trap, no focus-restore, no scroll lock — despite both using `role="alertdialog"`/`aria-modal="true"` markup that asserts to assistive tech that focus is contained. A sighted keyboard user can `Tab` straight past the dialog into the page behind the overlay; a screen-reader user's focus never moves into the dialog on open. Because these two guard "remove member from group" and "delete group" — the two most destructive actions in the app — the impact is higher than average. **Fix:** reuse `ConfirmDialog` (see `FE-004`) rather than patching each bespoke dialog.

### Positive findings (Info)

- **Interactive-div audit**: exactly one genuinely-interactive custom control found (`ChatSidebar.tsx`'s conversation-row), implemented correctly with `role="button"`, `tabIndex={0}`, and `Enter`/`Space` key handling. Every other `onClick`-on-`<div>` is a modal-backdrop dismiss-on-outside-click (acceptable — the actual dialog content is properly focusable/labelled) or a static, non-interactive status container.
- **Icon-only buttons**: no instances found missing `aria-label`.
- **Image alt text**: `PostMediaGrid.tsx` gives every attached image a generic-but-present `alt` ("Post attachment N of M") — not caption-level descriptive (not achievable without user-authored captions), but adequately present, never missing.

---

## Summary Table

| ID | Finding | Severity |
|---|---|---|
| FE-001 | Custom-visibility post can be submitted with zero recipients → silently visible to nobody | **High** |
| FE-003 | Inconsistent focus management across modals; weakest examples guard the most destructive actions | Medium |
| FE-004 | Duplicated, inconsistent modal implementations (root cause of FE-003) | Low-Medium |
| FE-005 | Module-scoped group cache not tied to auth/session lifecycle | Low |
| FE-006 | `.group-member-name` ellipsis has no effect without `white-space: nowrap` | Low |
| FE-007 | Login/Register cross-links use `<a>` instead of `next/link` | Low |
| — | `useState(Date.now)` hydration-fragile pattern, not currently exploitable | Info |
| — | No unstable list keys, no dead components, strong optimistic-update/cancellation patterns throughout | Info (positive) |
