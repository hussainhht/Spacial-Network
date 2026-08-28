# Person 2 — Posts, Comments & Group Posts

## Main Responsibility
Own the complete Posts and Comments features, including Group Posts and Group Comments.

This includes:
- Database migrations
- Backend logic
- API handlers
- Frontend UI
- Post/comment media handling
- Feature-level validation and testing

Authentication, Docker, and final project-wide integration are not included in this checklist.

---

## 1. Normal Posts

### Database
- [ ] Create `posts` table migration
- [ ] Store author/user ID
- [ ] Store post content
- [ ] Store image/GIF path when present
- [ ] Store post privacy type
- [ ] Store creation time
- [ ] Create matching `.down.sql` migration

### Backend
- [ ] Create a post
- [ ] Get posts/feed
- [ ] Get a single post
- [ ] Validate post content
- [ ] Save image path when an image is uploaded
- [ ] Save GIF path when a GIF is uploaded
- [ ] Return proper post data to the frontend
- [ ] Prevent unauthorized post access

### Frontend
- [ ] Create Post form
- [ ] Add text/content input
- [ ] Add image upload
- [ ] Add GIF upload
- [ ] Display posts in the feed
- [ ] Create reusable Post component
- [ ] Display post author
- [ ] Display post content
- [ ] Display post image/GIF
- [ ] Display post creation time if used

---

## 2. Post Privacy

The project requires three privacy levels.

### Public
- [ ] Allow all permitted users to view public posts

### Almost Private
- [ ] Allow only followers of the post owner to view the post
- [ ] Reuse follower relationship checks from the Profile/Followers feature

### Private
- [ ] Allow the post owner to select specific followers
- [ ] Create `post_allowed_users` table migration
- [ ] Store allowed user IDs for private posts
- [ ] Prevent users outside the selected list from accessing the post
- [ ] Create matching `.down.sql` migration

### Backend
- [ ] Validate privacy value
- [ ] Apply privacy checks when loading the feed
- [ ] Apply privacy checks when loading a single post
- [ ] Prevent direct API access to restricted posts
- [ ] Make sure the owner can always view their own post

### Frontend
- [ ] Add privacy selector
- [ ] Add Public option
- [ ] Add Almost Private option
- [ ] Add Private option
- [ ] Show follower selector when Private is selected
- [ ] Send selected follower IDs to the backend

---

## 3. Comments

### Database
- [ ] Create `comments` table migration
- [ ] Store post ID
- [ ] Store author/user ID
- [ ] Store comment content
- [ ] Store image/GIF path when present
- [ ] Store creation time
- [ ] Create matching `.down.sql` migration

### Backend
- [ ] Create comment
- [ ] Get comments for a post
- [ ] Validate comment content
- [ ] Allow image in comments
- [ ] Allow GIF in comments
- [ ] Apply the parent post's privacy/access rules
- [ ] Prevent commenting on a post the user cannot access
- [ ] Prevent reading comments of a post the user cannot access

### Frontend
- [ ] Create Comments section
- [ ] Display comments under a post
- [ ] Add Create Comment form
- [ ] Add image upload to comments
- [ ] Add GIF upload to comments
- [ ] Update comments after creating a new comment

---

## 4. Image & GIF Handling for Posts and Comments

- [ ] Support JPEG files
- [ ] Support PNG files
- [ ] Support GIF files
- [ ] Validate uploaded file type
- [ ] Validate file size according to the project's upload rules
- [ ] Generate safe/random filenames
- [ ] Store files in the agreed uploads directory
- [ ] Store only file path/name in SQLite
- [ ] Handle invalid uploads safely
- [ ] Reuse the existing upload/storage approach when possible

---

## 5. Group Posts

### Database
- [ ] Create `group_posts` table migration
- [ ] Store group ID
- [ ] Store author/user ID
- [ ] Store post content
- [ ] Store media path if supported
- [ ] Store creation time
- [ ] Create matching `.down.sql` migration

### Backend
- [ ] Create a post inside a group
- [ ] Get posts for a group
- [ ] Check group membership before creating a group post
- [ ] Check group membership before viewing group posts
- [ ] Prevent non-members from accessing group posts
- [ ] Reuse group membership logic from Person 1

### Frontend
- [ ] Display posts inside the group page
- [ ] Create Group Post form
- [ ] Hide group post content from non-members
- [ ] Refresh/update group posts after creating a post

---

## 6. Group Comments

### Database
- [ ] Create `group_comments` table migration
- [ ] Store group post ID
- [ ] Store author/user ID
- [ ] Store comment content
- [ ] Store creation time
- [ ] Create matching `.down.sql` migration

### Backend
- [ ] Create comment on a group post
- [ ] Get comments for a group post
- [ ] Check group membership before creating a comment
- [ ] Check group membership before viewing comments
- [ ] Prevent non-members from accessing group comments

### Frontend
- [ ] Display comments under group posts
- [ ] Add comment form to group posts
- [ ] Update group comments after creating one

---

## 7. Dependencies on Other Team Members

From Person 1:
- [ ] Use the shared group membership check for group posts/comments

From Person 3:
- [ ] Use follower relationship checks for Almost Private posts
- [ ] Get follower list for Private post selection

---

## 8. Feature Testing

- [ ] Test creating public posts
- [ ] Test Almost Private posts
- [ ] Test selected-follower Private posts
- [ ] Test unauthorized post access
- [ ] Test image uploads
- [ ] Test GIF uploads
- [ ] Test creating comments
- [ ] Test comment access rules
- [ ] Test group post membership restrictions
- [ ] Test group comments
- [ ] Test invalid file types
