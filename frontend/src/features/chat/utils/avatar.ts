import { getBackendBaseUrl } from "@/lib/api";

export function getChatAvatarUrl(photo?: string): string | undefined {
  if (!photo) return undefined;
  if (/^https?:\/\//i.test(photo)) return photo;

  const path = photo.startsWith("/") ? photo : `/uploads/${photo}`;
  return `${getBackendBaseUrl()}${path}`;
}