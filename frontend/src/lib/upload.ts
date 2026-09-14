// Client-side validation for optional image/GIF attachments on posts and
// comments. Mirrors the backend's allow-list (see backend/internal/upload):
// JPEG, PNG, GIF, and WebP, sniffed by magic bytes rather than trusted by
// file extension or the browser-reported MIME type, up to 5MB. The server
// re-validates independently - this only gives users fast, friendly
// feedback before a request is ever sent.

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_POST_MEDIA = 4;
export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/gif,image/webp";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sniffImageType(file: File): Promise<string | null> {
  const buffer = await file.slice(0, 12).arrayBuffer();
  const hex = bytesToHex(new Uint8Array(buffer));

  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
  if (hex.startsWith("474946383761") || hex.startsWith("474946383961")) return "image/gif";
  if (hex.startsWith("52494646") && hex.slice(16, 24) === "57454250") return "image/webp";

  return null;
}

// validateImageFile inspects the file's actual content (not its name or
// declared MIME type) and returns a user-facing error message, or null if
// the file is acceptable.
export async function validateImageFile(file: File): Promise<string | null> {
  if (file.size > MAX_IMAGE_SIZE) {
    return "Image must be 5MB or smaller";
  }

  const detectedType = await sniffImageType(file);
  if (!detectedType) {
    return "Image must be a JPEG, PNG, GIF, or WebP file";
  }

  return null;
}
