/**
 * API & WebSocket configuration helper.
 * Production defaults to same-origin; development uses port 8080.
 * Override at BUILD TIME with NEXT_PUBLIC_BACKEND_ORIGIN and
 * NEXT_PUBLIC_BACKEND_WS_ORIGIN.
 */
import { DEMO_MODE } from "@/demo/config";

export const BACKEND_PORT = 8080;
/**
 * Returns the backend hostname.
 */
export function getBackendHost(): string {
  if (DEMO_MODE) return "demo.invalid";
  return new URL(getBackendBaseUrl() || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")).hostname;
}

/**
 * Returns the backend HTTP base URL.
 */
export function getBackendBaseUrl(): string {
  if (DEMO_MODE) return "";
  return (process.env.NEXT_PUBLIC_BACKEND_ORIGIN ??
    (process.env.NODE_ENV === "development" ? `http://localhost:${BACKEND_PORT}` : "")).replace(/\/$/, "");
}

/**
 * Returns the REST API base URL ("/api" in production).
 */
export function getApiBaseUrl(): string {
  return `${getBackendBaseUrl()}/api`;
}

/**
 * Builds a full API endpoint URL from a sub-path.
 * Example: getApiUrl("/login") -> "/api/login"
 */
export function getApiUrl(path: string = ""): string {
  if (!path) return getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${cleanPath}`;
}

/**
 * Returns the uploads base URL ("/uploads" in production).
 */
export function getUploadsBaseUrl(): string {
  return `${getBackendBaseUrl()}/uploads`;
}

/**
 * Returns the WebSocket URL.
 */
export function getWebSocketUrl(path: string = "/api/ws"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const configured = process.env.NEXT_PUBLIC_BACKEND_WS_ORIGIN;
  const origin = configured || getBackendBaseUrl() ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin.replace(/^http:/, "ws:").replace(/^https:/, "wss:").replace(/\/$/, "")}${cleanPath}`;
}

/**
 * Configuration object with property getters for convenience.
 */
export const apiConfig = {
  get backendBaseUrl() {
    return getBackendBaseUrl();
  },
  get apiBaseUrl() {
    return getApiBaseUrl();
  },
  get uploadsBaseUrl() {
    return getUploadsBaseUrl();
  },
  get wsUrl() {
    return getWebSocketUrl();
  },
};
