# 09. Uploads & Media Runtime & E2E Audit

## 1. Executive Domain Summary

The file upload and static media serving subsystems were audited dynamically across multiple endpoints:
- User avatar update (`PATCH /api/users/me/avatar`)
- Post media attachments (`POST /api/posts`)
- Static media serving (`GET /uploads/*`)

The audit tested valid uploads (PNG, GIF), format restrictions (WebP on avatars vs posts), security sniffing (MIME spoofing), oversized payloads (> 5 MiB), and static directory exposure.

Key runtime findings:
1. **True Content Sniffing:** The backend utilizes `http.DetectContentType` on the initial 512 bytes of uploaded files. Client-supplied file extensions or `Content-Type` headers are ignored. Spoofed files (e.g. ASCII text named `malicious.png`) are detected and rejected (`400 unsupported image file type`).
2. **Asymmetric WebP Support:** While WebP is supported for post/comment media attachments (`upload.allowedMediaTypes`), it is strictly rejected for profile avatars (`upload.allowedAvatarTypes`).
3. **Collision-Proof Storage:** All uploads are persisted with UUID v4 filenames in dedicated subdirectories (`avatars/`, `posts/`, `comments/`, `groups/`, `events/`).
4. **Information Disclosure (Directory Listing):** The static file server mounted at `/uploads/` allows full directory browsing when accessed without a file path (`HTTP 200 OK` rendering HTML directory index).

---

## 2. Format Support & Upload Matrix

| Target Feature | Endpoint | Accepted Formats | WebP Allowed? | Max Size | Form Field Name |
|---|---|---|:---:|:---:|---|
| **User Avatar** | `PATCH /api/users/me/avatar` | JPEG, PNG, GIF | **No (Rejected)** | 5 MiB | `profilePhoto` |
| **Post Attachment** | `POST /api/posts` | JPEG, PNG, GIF, WebP | **Yes** | 5 MiB per file (max 4) | `image` |
| **Comment Attachment** | `POST /api/posts/{id}/comments` | JPEG, PNG, GIF, WebP | **Yes** | 5 MiB | `image` |
| **Group Photo** | `POST /api/groups` | JPEG, PNG, GIF | **No** | 5 MiB | `groupPhoto` |
| **Event Cover** | `POST /api/groups/{id}/events` | JPEG, PNG, GIF, WebP | **Yes** | 5 MiB | `image` |

---

## 3. Validation & Security Sniffing Tests

Direct multipart tests executed against `PATCH /api/users/me/avatar`:

| Test Case | Payload Description | HTTP Status | Response Payload | Verdict |
|---|---|:---:|---|:---:|
| **Valid PNG Upload** | Real 1x1 PNG bytes, `name="profilePhoto"` | `200 OK` | `{"success":true,"message":"Profile photo updated","profile":{"profile_photo":"/uploads/avatars/1b04a916-3f0f-40cb-b7e5-7e1752cb2326.png",...}}` | **PASS** |
| **WebP on Avatar** | Valid WebP binary bytes | `400 Bad Request` | `{"success":false,"message":"unsupported image file type"}` | **PASS (Strict Policy)** |
| **MIME Spoofing** | ASCII text named `malicious.png` with header `image/png` | `400 Bad Request` | `{"success":false,"message":"unsupported image file type"}` | **PASS (Sniffing Enforced)** |
| **Unsupported PDF** | Valid `%PDF-1.4` file named `doc.pdf` | `400 Bad Request` | `{"success":false,"message":"unsupported image file type"}` | **PASS** |
| **Oversized File** | Valid PNG header + 5.5 MiB payload | `400 Bad Request` | `{"success":false,"message":"file exceeds the maximum allowed size"}` | **PASS (Bound Enforced)** |
| **Mismatched Field Name** | Sent file as `name="avatar"` instead of `profilePhoto` | `400 Bad Request` | `{"success":false,"message":"profilePhoto or remove_photo is required"}` | **CONFIRMED** |

---

## 4. Static Serving & Persistence Verification

Following successful upload of `/uploads/avatars/1b04a916-3f0f-40cb-b7e5-7e1752cb2326.png`:
```http
GET /uploads/avatars/1b04a916-3f0f-40cb-b7e5-7e1752cb2326.png HTTP/1.1
Host: localhost:8080

HTTP/1.1 200 OK
Accept-Ranges: bytes
Content-Length: 67
Content-Type: image/png
Last-Modified: Wed, 16 Sep 2026 23:07:10 GMT
```
- File is accessible without authentication (public static asset).
- Accurate `Content-Type` header (`image/png`) returned by standard library `http.FileServer`.

---

## 5. Security Observation: Open Directory Listing (RT-UPLOAD-001)

When querying the root uploads directory:
```bash
curl -s -i http://localhost:8080/uploads/
```
The server returns:
```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<!doctype html>
<meta name="viewport" content="width=device-width">
<pre>
<a href="avatars/">avatars/</a>
<a href="comments/">comments/</a>
<a href="events/">events/</a>
<a href="groups/">groups/</a>
<a href="posts/">posts/</a>
</pre>
```
Because `http.FileServer` is used directly without disabling directory listing, any user or external visitor can enumerate all stored files, subdirectories, and media attachments by browsing `/uploads/avatars/`, `/uploads/posts/`, etc.

---

## 6. Discovered Issues & Observations

| Issue ID | Severity | Title | Summary |
|---|:---:|---|---|
| **RT-UPLOAD-001** | **Medium** | Static `/uploads/` directory enables open directory listing | Standard `http.FileServer` serves HTML directory indexes for `/uploads/` and its subdirectories, exposing uploaded file UUIDs to anyone who browses the root URL. |
| **RT-UPLOAD-002** | **Info** | Asymmetric WebP support across upload endpoints | WebP is permitted for posts/comments/events but rejected for user avatars and group photos. |

