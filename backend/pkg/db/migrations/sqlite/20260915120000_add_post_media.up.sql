PRAGMA foreign_keys = ON;

CREATE TABLE post_media (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL,
    file_path  TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'gif')),
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    UNIQUE (post_id, sort_order)
);

CREATE INDEX idx_post_media_post_id ON post_media(post_id);

INSERT INTO post_media (post_id, file_path, media_type, sort_order, created_at)
SELECT id,
       image_path,
       CASE WHEN lower(image_path) LIKE '%.gif' THEN 'gif' ELSE 'image' END,
       0,
       created_at
FROM posts
WHERE image_path IS NOT NULL AND image_path != '';
