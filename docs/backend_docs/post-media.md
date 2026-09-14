# Post media

Posts originally stored one optional attachment in `posts.image_path`. Multiple
attachments now use the normalized `post_media` child table so every file has
its own row, type, and deterministic position. `post_media.post_id` references
`posts.id` with `ON DELETE CASCADE`, and `(post_id, sort_order)` is unique.

Migration `20260915120000_add_post_media` creates the table and backfills every
non-empty legacy `image_path` as position `0`. New writes continue mirroring the
first attachment to `image_path` for older clients and migration rollback, but
`post_media` is authoritative.

Create requests use multipart form data with repeated `media` fields, up to four
JPEG, PNG, GIF, or WebP files of 5 MiB each. The backend content-sniffs every
file, generates a random filename, cleans up files if validation or persistence
fails, and creates the post, media rows, and selected-audience rows in one
database transaction. The legacy singular `image` field is still accepted.

Post create, feed, group-feed, and detail responses include an ordered array:

```json
{
  "media": [
    { "id": 12, "url": "/uploads/posts/example.jpg", "type": "image", "order": 0 }
  ]
}
```

`image_url` remains as a compatibility alias for the first media item. The
frontend composer and persisted post views both render `media` through the
shared `PostMediaGrid` component.
