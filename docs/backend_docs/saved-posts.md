# Saved posts (bookmarks)

Private, per-account bookmarks. Only the account that saved a post can see or change its bookmark.

## Storage

Migration `20260917120000_create_user_saved_posts_table`:

| Column | Notes |
| --- | --- |
| `id` | `AUTOINCREMENT`; grows with every new bookmark, so it orders and paginates the collection |
| `user_id` | FK to `users`, `ON DELETE CASCADE` |
| `post_id` | FK to `posts`, `ON DELETE CASCADE` |
| `created_at` | when the post was saved |

Unique index on `(user_id, post_id)` prevents duplicates. Indexes on `(user_id, id DESC)` and `post_id` serve the listing and the cascade.

## API

All routes require a session; the user is always taken from it.

| Route | Behaviour |
| --- | --- |
| `POST /posts/{id}/save` | Saves a post the caller can currently view. Idempotent. `404` for a missing post *or* one the caller can't see (indistinguishable). Responds `{post_id, saved: true}`. |
| `DELETE /posts/{id}/save` | Removes the caller's bookmark. Idempotent and does not check post visibility, so a stale bookmark can always be cleared. Responds `{post_id, saved: false}`. |
| `GET /users/me/saved-posts?limit=&cursor=` | `{posts, next_cursor?}`, most recently saved first (`limit` max 50). Pass `next_cursor` back as `cursor`. |

Post responses (feed, group feed, detail) also carry `saved` for the viewer.

## Privacy rules

- Visibility is rechecked on every read with the same `canAccessPost` logic the rest of the posts API uses. A post that was deleted, made followers-only/custom, or whose group the user left is skipped, with no title, media, author or id exposed.
- The bookmark row is kept, so regaining access brings the post back; it never grants access.
- Repeated saves keep the original row, so a post keeps its place in the order. Unsave then save moves it to the top.

## Demo mode

`DemoState.saved` maps a demo user id to that identity's `{id, post_id}` entries. Old stored demo data without it still loads; Reset Demo clears it.
