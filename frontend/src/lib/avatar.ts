import { getBackendBaseUrl, getUploadsBaseUrl } from "@/lib/api";

export function resolveAvatarUrl(source?: string | null): string | undefined {
  const value = source?.trim();
  if (!value) return undefined;
  if (/^(?:https?:|blob:|data:)/i.test(value)) return value;

  const backend = getBackendBaseUrl();
  if (value.startsWith("/")) return `${backend}${value}`;
  if (value.startsWith("uploads/")) return `${backend}/${value}`;
  return `${getUploadsBaseUrl()}/${value.replace(/^\/+/, "")}`;
}
