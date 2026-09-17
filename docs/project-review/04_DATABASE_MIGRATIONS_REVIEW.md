# 04 — Database & Migrations Review

> Scope: all 30 migration pairs in `backend/pkg/db/migrations/sqlite/`, `docs/database/schema.dbml`, and `backend/internal/*/repository.go` query quality. Methodology: claims about SQLite `ALTER TABLE` behavior, index usage, and down-migration reversibility were **reproduced**, not taken on faith — against throwaway scratch SQLite databases and against the real `EXPLAIN QUERY PLAN` output of the live `backend/data/social-network.db`. No files were modified; only read-only queries were used.

## Overall Assessment

Migration numbering is consistent (30 timestamp-prefixed pairs, strictly monotonic, `schema_migrations` on the live DB confirms all 30 applied in order); each migration runs in its own transaction, so a failure rolls back cleanly. Most up/down pairs round-trip correctly, including subtler cases (dropping an indexed column in the right order; dropping a column with its own `CHECK` constraint). The repository layer is well-written overall — deterministic cursor pagination, batched `IN (...)` lookups instead of per-row queries, idempotent upserts relying on unique indexes instead of check-then-insert races. **No genuine N+1 pattern was found anywhere.** The real issues are: one migration that is empirically **not** reversible under its own intended use case, a set of missing indexes on FK columns that will matter once tables grow past dev-scale, and a systemically stale `schema.dbml` that should not be trusted for anything.

---

## 1. Migration Pairing & Reversibility

### DB-001 — `pending_group_attempts` down-migration fails under normal, expected data (reproduced)

**Severity:** High · **Confidence:** High (empirically reproduced)

Files: `20260906120000_pending_group_attempts.up.sql` / `.down.sql`. The up-migration replaces full `UNIQUE(group_id, invited_user_id)`/`UNIQUE(group_id, user_id)` indexes on `group_invitations`/`group_join_requests` with **partial** unique indexes (`WHERE status = 'pending'`), specifically so a user can be invited/declined and then invited again — i.e. so history (multiple non-pending rows for the same group+user) can accumulate. The down-migration recreates the original **full** unique index with no `WHERE` clause. The file's own comment admits this: *"Repeated historical attempts make CREATE UNIQUE INDEX fail, rolling back all index changes."*

**Reproduced directly** with the exact scenario the up-migration exists to support — one `declined` row followed by one `pending` re-request for the same `group_id`/`user_id`:
```
INSERT ... (1, 100, 'declined')
INSERT ... (1, 100, 'pending')
DROP INDEX idx_group_join_requests_group_user;
CREATE UNIQUE INDEX idx_group_join_requests_group_user ON group_join_requests(group_id, user_id);
-- Runtime error: UNIQUE constraint failed
```
Same defect applies symmetrically to `group_invitations`. **This is not an edge case** — "declined once, invited/requested again" is the exact flow this migration was written to support, so it will occur in ordinary production use almost immediately. From that point, `MigrateDown`/`MigrateDownAll` cannot roll back past this migration (the attempt fails cleanly — the runner wraps the whole file in one transaction with rollback-on-error, so no corruption occurs — but rollback tooling is broken for this version and everything below it). **Fix:** either document this migration as one-way (remove the misleading round-trippable down file), or change the down migration to first collapse history (keep only the latest row per group/user, or add a disambiguator) before recreating the full unique index.

### Verified correct (Info, positive findings)

- Simple `ADD COLUMN`/`DROP COLUMN` pairs round-trip correctly, including a column carrying its own `CHECK` constraint (`is_private`) — confirmed SQLite 3.45 permits this against a populated table.
- Index-then-drop-column ordering is handled correctly everywhere it matters (`add_group_privacy.down.sql`, `add_group_id_to_posts.down.sql` both drop the dependent index before the column).
- `ADD COLUMN ... REFERENCES ... ON DELETE CASCADE` (adding `posts.group_id`) works as written — reproduced against a populated table with FKs enabled.
- No `ALTER TABLE ... ADD COLUMN ... NOT NULL` was added without an explicit `DEFAULT` on an already-populated table, anywhere across all 30 migrations. **Zero violations found.**
- `add_visibility_to_posts.down.sql` intentionally, unavoidably collapses `followers`/`custom` both down to the old boolean `private=1` on downgrade — a deliberate, acceptable lossy tradeoff, not a bug.

### DB-009 — `add_post_media` migration leaves `posts.image_path` permanently denormalized; down migration loses multi-image data

**Severity:** Low · **Confidence:** High

The up-migration copies every non-empty `posts.image_path` into the new `post_media` table but never drops the column — deliberately kept, per the code's own comment, "for safe rollback to the pre-media-table schema." Two consequences: (1) `image_path` never updates if a post's media set is edited post-creation (`UpdatePost` doesn't touch it) — latent staleness risk, no current code path triggers it; (2) the down migration only does `DROP TABLE post_media`, so any 2nd/3rd photo on a multi-image post is permanently lost on downgrade (only the first item, mirrored in `image_path`, survives). Acceptable for a downgrade path but worth documenting explicitly.

---

## 2. Foreign Keys & Cascades

All FKs are `ON DELETE CASCADE`; none use `RESTRICT`/`SET NULL`/`NO ACTION` anywhere in the schema. `ON UPDATE` is never used, which is fine since all PKs are immutable auto-increment integers.

### DB-002 — `notifications.actor_id` is nullable (for system notifications) but cascades instead of nulling, causing third-party data loss

**Severity:** Medium · **Confidence:** High

`actor_id` is nullable specifically to support actor-less system notifications, yet its FK is `ON DELETE CASCADE`, not `SET NULL`. **Observed:** deleting user A, who merely liked/commented/followed user B at some point, deletes **every notification row where A is the actor** — including notifications belonging to (received by) a completely different user B who did nothing. **Expected:** `ON DELETE SET NULL`, preserving B's notification history with the actor anonymized, consistent with the column already being nullable for exactly this purpose. **Why it matters:** silent, receiver-side data loss triggered by an unrelated third party's account deletion — a real product-visible bug, not corruption. **Fix:** change the FK to `ON DELETE SET NULL`.

### Low/Info — `pending_group_attempts`'s "preserve history" goal is undercut by CASCADE on the same tables

The partial-unique-index rework (DB-001) exists specifically to preserve non-pending invitation/join-request rows as history, but those tables' FKs to `users(id)` are all `CASCADE` — so that history is wiped the moment *either* party deletes their account. Doesn't break anything (no orphans/violations), just means the preserved "history" isn't durable against account deletion. Worth a note if this history is ever relied on for UX ("you already asked to join this group before") or audit purposes.

### Verified correct (Info): self-referential integrity, cascade correctness elsewhere

`followers` (`CHECK (follower_id <> followed_id)`) and `follow_requests` (`CHECK (requester_id <> target_id)`) both prevent self-follow/self-request at the DB layer, not just app layer. All other cascades (groups/posts/comments/likes/sessions/private_messages/group_messages/events/event_responses/follow_requests/followers/post_allowed_viewers/post_media/group_members) correctly remove dependent rows rather than orphaning them; `groups.DeleteGroup`'s reliance on cascade for members/invitations/join-requests/events/event-responses was explicitly verified true against the schema.

---

## 3. Indexes & Constraints

### DB-003 — Most FK columns referencing `users(id)` have no supporting index, forcing full table scans on every cascading user deletion

**Severity:** Medium · **Confidence:** High (verified via `EXPLAIN QUERY PLAN` against the live DB)

Confirmed `SCAN` (not `SEARCH`) for the cascade-delete pattern on: `sessions.user_id`, `posts.user_id`, `comments.user_id`, `likes.user_id` (only trailing column of a composite unique index), `group_members.user_id` (same), `notifications.actor_id`, `group_invitations.invited_by`/`invited_user_id`, `group_join_requests.user_id`, `events.created_by`, `group_messages.user_id`, `event_responses.user_id`. Contrast with `post_allowed_viewers.user_id`, which **is** correctly indexed and confirmed to produce a real `SEARCH`. **Why it matters:** deleting a user cascades through essentially every table in the schema; given `db.SetMaxOpenConns(1)`, the single shared connection is blocked for the duration of *all* these scans on every account deletion — every other request, including unrelated WebSocket chat traffic, queues behind it. Currently harmless at dev-scale row counts (`users=8, posts=11, likes=3`), but structurally real and will surface as a stall once tables grow. **Fix:** add single-column (or FK-leading composite) indexes on each column listed above.

### DB-004 — The main feed query (`ListPosts`) full-scans `posts` and performs an extra temp-sort; no index on `created_at`

**Severity:** Medium · **Confidence:** High (verified via `EXPLAIN QUERY PLAN`)

`posts` has exactly one index (`idx_posts_group_id`). Running `ListPosts`'s actual query text against the live DB shows the correlated `EXISTS` subqueries (follower check, allowed-viewer check, group-membership check) are all properly indexed, but the outer `posts` scan is unindexed (inherent to the multi-branch `OR` visibility predicate) **and** SQLite materializes a temp B-tree for `ORDER BY datetime(p.created_at) DESC, p.id DESC` because no index covers `created_at` at all. This is the hottest endpoint in the app, hit on every page load, not just account deletions. **Fix:** at minimum add `CREATE INDEX idx_posts_created_at ON posts(created_at DESC, id DESC)` to remove the temp-sort step.

### DB-010 — `posts.group_id` index isn't composite with `created_at`, unlike equivalent indexes elsewhere in the same schema

**Severity:** Low · **Confidence:** High

`ListPostsByGroup` (`WHERE group_id = ? ORDER BY created_at DESC LIMIT ?`) correctly uses `idx_posts_group_id` for the `WHERE` but still needs a temp B-tree for the `ORDER BY`, because that index is single-column. The codebase already knows this pattern and fixes it elsewhere — `idx_group_messages_group_created ON group_messages(group_id, created_at ASC)` and `idx_groups_privacy_created_at ON groups(privacy, created_at DESC, id DESC)` are both composite `(filter_col, created_at)` indexes for exactly this reason. `posts(group_id)` is the one place this was missed. **Fix:** replace with a composite `(group_id, created_at DESC, id DESC)` index.

### DB-005 — `sessions.user_id` has no UNIQUE constraint; combined with a non-transactional check-then-act in `CreateSession`, concurrent logins can create duplicate active sessions

**Severity:** Medium · **Confidence:** High

No unique/index on `user_id` at all (only `id`/PK and `session_token`/UNIQUE). `auth.Repository.CreateSession` does a `SELECT` to check for an existing session, then a separate `UPDATE`/`INSERT` round-trip — despite `db.SetMaxOpenConns(1)`, these are two independent connection acquisitions, not one atomic operation. A second concurrent `CreateSession` call for the *same* user (double-click, two tabs, a retried request — realistic client behavior) can acquire the connection for its own `SELECT` in the gap, see "no row" too, and also `INSERT` — producing two live session rows for one user, silently violating the one-session-per-user invariant this code is clearly trying to enforce. A subsequent logout by `session_token` then only revokes one of the two rows. **Fix:** wrap in a transaction, or replace with a single upsert guarded by a real `UNIQUE(user_id)` constraint, matching the pattern already used correctly elsewhere in the codebase (`followers.CreateFollowRequest`, event-RSVP upsert). Cross-referenced as `AUTH-005` in `05_AUTH_SECURITY_PRIVACY_REVIEW.md`.

### Verified correct: all business-rule uniqueness constraints present, except one intentional inconsistency

One follow per pair ✓, one like per (post,user) ✓ (tied to `INSERT OR IGNORE` idempotency, verified consistent), one membership per (group,user) ✓, one pending invitation/join-request per (group,user) ✓ via the partial-index pattern from DB-001, one response per (event,user) ✓ via upsert, one (post,sort_order) slot ✓.

**Low/Info** — `follow_requests` uses a **full** `UNIQUE(requester_id, target_id)` index (not the partial `WHERE status='pending'` pattern its group-invitation/join-request siblings got), worked around correctly via an `ON CONFLICT ... DO UPDATE` upsert — functionally correct, but as a side effect declined follow requests overwrite in place and no history of past declines is retained, unlike group invitations/join requests where history retention was a deliberate goal. Not a bug, just a design inconsistency worth noting if follow-request history is ever wanted.

---

## 4. Schema.dbml Drift

All 4 discrepancies flagged by the prior (Gemini) audit are **confirmed true** by direct migration inspection, plus **10 additional undocumented drift items** found in this pass:

**Confirmed from prior audit:**
1. `schema.dbml` defines separate `group_posts`/`group_post_media`/`group_comments`/`group_comment_media` tables that don't exist — group posts unify into `posts` via nullable `group_id`; group comments simply reuse the single `comments` table.
2. `schema.dbml` has no `likes` table at all; the real one exists with a `UNIQUE(post_id, user_id)` index.
3. `schema.dbml` names the followers column `following_id`; actual is `followed_id` (every consumer in `followers/repository.go` uses `followed_id`).
4. `schema.dbml` documents post privacy as `privacy: public|followers|private`; actual column is `visibility` with values `public|followers|custom`, backed by `post_allowed_viewers`.

**New drift found (not in the prior audit):**
5. `sessions`: dbml has `token`/`updated_at`; actual is `session_token`/`revoked_at` (used throughout logout/expiry logic) — `updated_at` doesn't exist at all.
6. `private_messages`: dbml uses `receiver_id` + a phantom `is_read` boolean; actual is `recipient_id`, and read status is derived purely from `read_at IS NULL` (no `is_read` column exists).
7. `notifications`: **the largest single drift** — dbml's `user_id`/`notification_type`/`reference_type`/`reference_id`/`is_read` map to actual `receiver_id`/`type`/`entity_type`/`entity_id`/`read_at` — 4 of 6 substantive columns misnamed, one fabricated.
8. `posts`: dbml is missing the `title` column entirely (a `NOT NULL` column every post insert/select depends on), in addition to the already-confirmed missing `image_path`/`group_id`.
9. `post_allowed_viewers` is called `post_allowed_users` in dbml.
10. `users`: dbml is missing `age` entirely (a required `NOT NULL CHECK` registration field), has `avatar_path` where the real column is `profile_photo`, and marks `date_of_birth` `not null` when it's actually nullable (app-layer-only enforcement).
11. `groups`: dbml is missing the `group_photo` column.
12. `comments`: dbml models a separate `comment_media` table that doesn't exist; the real mechanism is a single `image_path` column directly on `comments`.
13. `post_media`: dbml is missing the `sort_order` column that guarantees deterministic media ordering.
14. `events`: dbml is missing the `image_path` column.

**Overall:** `schema.dbml` reflects an early design draft never updated across ~30 migrations. Every table that gained columns after its initial migration has drift; `notifications` and `posts` are the most misleading. `group_posts`/`group_comments`/their media tables and `comment_media` describe features that were never built this way. **Recommendation:** regenerate `schema.dbml` from the live schema (script it off `sqlite_master`/`PRAGMA table_info`) or drop it in favor of the migrations being the single source of truth. **This is a documentation issue, not an application defect** — cross-checking confirmed the Go repository code has stayed correctly in sync with the real schema throughout (§6).

---

## 5. Query Quality

### DB-008 — Unbounded (no `LIMIT`) list queries

**Severity:** Medium · **Confidence:** High

`followers.GetFollowers`/`GetFollowing`, `groups.GetGroupMembers`, `comments.ListCommentsByPost`, `event_repository.GetEventsByGroup` all return every matching row with no bound — contrast with `chat.GetPrivateHistory`/`GetGroupHistory`, `groups.GetAllGroups`/`GetGroupsForUser`, and `posts.ListPosts`/`ListPostsByGroup`, which all correctly clamp/require a `LIMIT`. For a popular account (many followers) or a viral post (many comments), these become large single-query result sets fully materialized and marshaled in one request. **Fix:** add `LIMIT`/cursor pagination to all four.

### DB-012 — Pagination clamp bug: an over-limit request silently collapses to the small default, not the max

**Severity:** Low · **Confidence:** High

`chat.GetPrivateHistory`/`GetGroupHistory` (`if limit<=0 || limit>50 { limit = 10 }` / `= 20`). A client requesting 60 messages gets clamped down to 10/20, not the intended ceiling of 50. Fails safe (under- not over-fetches), so not a correctness/security issue — just a likely-unintended off-by-logic. Duplicated 3x across the backend with 3 different literal pairs (cross-referenced as `DX-001` in `09_CODE_QUALITY_TECH_DEBT.md`, which covers the duplication angle; this entry covers the query-quality angle for the same root defect — **one root cause, counted once in the issue register**).

### DB-013 / DB-014 — Minor, Low-severity items

- `SELECT * FROM mutual_candidates`/`fallback_candidates` (`followers/repository.go`) — both are CTEs with explicit column lists defined a few lines above in the same statement, not `SELECT * FROM <table>`, so not exposed to schema drift the usual way `SELECT *` is. Still worth aligning with the rest of the codebase's explicit-column convention.
- `likes.CreateLike`'s already-liked read-back is a separate, non-transactional `GetLike` call after an `INSERT OR IGNORE` reports 0 rows affected — a concurrent unlike in that narrow gap can make a successful "like" call propagate `ErrLikeNotFound`. Narrow window, cosmetic failure mode, not data loss.

### Verified correct (Info, positive): no N+1 patterns, correct transactions where it matters

No genuine N+1 (query-inside-a-loop-over-a-result-set) pattern was found anywhere in the repository layer — the only loops around `db.Exec`/`tx.Exec` are bounded, transaction-wrapped, per-item write loops for caller-controlled variable-length input (post media rows, viewer grants), not a query-count problem tied to result-set size. `groups.InsertGroup` (group + creator membership) was specifically checked, per this audit's brief, and **is** correctly transaction-wrapped — not a defect. `posts.CreatePost`, `posts.SetAllowedViewerIDs`, `followers.UnfollowUser`, `followers.AcceptFollowRequest` are likewise all correctly transaction-wrapped.

---

## 6. Column/Type Mismatches

Spot-checked columns selected/inserted across `posts`, `users`, `notifications`, `likes`, `followers`, `sessions`, `events`, `post_media`, `comments`, `private_messages` repositories against their migration history. **All column names and positions match exactly** — no runtime-only breakage found in any repository file. Worth stating positively: despite ~30 incremental migrations, the Go application code has stayed fully in sync with the schema; all the drift is confined to the hand-maintained `schema.dbml` documentation (§4), not the actual application.

### DB-006 — Timestamp columns mix two incompatible textual formats within the same logical type; one query relies on raw string ordering that only works if formats don't mix

**Severity:** Medium · **Confidence:** High (verified against live data)

SQLite has no native `DATETIME` type; every timestamp column is `TEXT` affinity, and its representation depends on how the inserting code produced it. Two conventions coexist: columns relying on `DEFAULT CURRENT_TIMESTAMP` render as `'YYYY-MM-DD HH:MM:SS'` (UTC, no offset); columns bound from an explicit Go `time.Time` (`posts.CreatePost`, `comments`, `likes`, `auth.CreateSession`) are serialized by the driver with fractional seconds **and a timezone offset**. This is not hypothetical — querying the live DB directly confirmed both formats present simultaneously, with the offset itself varying between tables/insert times (`+00:00` on `posts`/`comments`/`followers`/`users`, `+03:00` on `likes`). SQLite's `datetime()` function correctly normalizes both for comparison, and `posts.ListPosts` correctly wraps both sides in `datetime(...)` for its cursor pagination — but `posts.ListPostsByGroup` sorts with a **raw** `ORDER BY created_at DESC`, no `datetime()` wrapper, on the same column that's always stored in the offset-suffixed format for that table. Raw lexicographic string comparison across *different* timezone offsets does not reliably match true chronological order. Given the live DB already shows mixed offsets across insert paths/environments, this is a live risk for any deployment where server-local timezone isn't pinned to UTC or changes between rows (redeploys, DST, containers with differing `TZ`). **Fix:** either standardize on `time.Now().UTC()` everywhere a timestamp is bound explicitly (more durable), or make `ListPostsByGroup` wrap its `ORDER BY` in `datetime(...)` like `ListPosts` already does (immediate parity fix).

---

## Summary Table

| ID | Finding | Severity |
|---|---|---|
| DB-001 | `pending_group_attempts` down-migration fails under normal declined→re-request data (reproduced) | **High** |
| DB-002 | `notifications.actor_id` cascades instead of `SET NULL` — deletes receivers' notification history | Medium |
| DB-003 | Missing indexes on FK columns to `users(id)` → full scans on every cascading delete | Medium |
| DB-004 | `posts.ListPosts` (main feed) full-scans + extra temp-sort; no `created_at` index | Medium |
| DB-005 | `sessions.user_id` no UNIQUE + non-transactional `CreateSession` → duplicate sessions race | Medium |
| DB-006 | Mixed timestamp formats; `ListPostsByGroup` raw string sort risk (verified live) | Medium |
| DB-008 | Unbounded list queries (`GetFollowers`/`GetFollowing`/`GetGroupMembers`/`ListCommentsByPost`) | Medium |
| DB-009 | `add_post_media` leaves `posts.image_path` permanently denormalized, latent staleness | Low |
| DB-010 | `posts.group_id` index not composite with `created_at`, unlike equivalent indexes elsewhere | Low |
| DB-011 | `follow_requests` full-unique-index design loses decline history (vs. group invitations' pattern) | Low |
| DB-012 | Pagination clamp bug: over-max collapses to default, not max (chat history) | Low |
| DB-013 | `SELECT *` from CTEs (not raw tables) | Low |
| DB-014 | Minor read-after-write race in `likes.CreateLike`'s already-liked read-back | Low |
| DB-007 | `schema.dbml` drift: 4 confirmed + 10 additional items | Info (documentation only) |
| — | No `NOT NULL`-without-`DEFAULT` migrations; no N+1 patterns; no repository/schema column mismatches; `groups.InsertGroup` correctly transactional | Info (positive) |
