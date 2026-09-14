/**
 * API & WebSocket configuration helper.
 * Configured for localhost on port 8080 by default. Docker and deployed
 * environments can override these with NEXT_PUBLIC_BACKEND_ORIGIN and
 * NEXT_PUBLIC_BACKEND_WS_ORIGIN.
 */

const DEFAULT_BACKEND_ORIGIN = "http://localhost:8080";

function cleanOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/**
 * Returns the backend hostname.
 */
export function getBackendHost(): string {
  return new URL(getBackendBaseUrl()).hostname;
}

/**
 * Returns the backend HTTP base URL.
 */
export function getBackendBaseUrl(): string {
  return cleanOrigin(
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? DEFAULT_BACKEND_ORIGIN,
  );
}

/**
 * Returns the REST API base URL ("http://localhost:8080/api").
 */
export function getApiBaseUrl(): string {
  return `${getBackendBaseUrl()}/api`;
}

/**
 * Builds a full API endpoint URL from a sub-path.
 * Example: getApiUrl("/login") -> "http://localhost:8080/api/login"
 */
export function getApiUrl(path: string = ""): string {
  if (!path) return getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${cleanPath}`;
}

/**
 * Returns the uploads base URL ("http://localhost:8080/uploads").
 */
export function getUploadsBaseUrl(): string {
  return `${getBackendBaseUrl()}/uploads`;
}

/**
 * Returns the WebSocket URL.
 */
export function getWebSocketUrl(path: string = "/api/ws"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const defaultWsOrigin = getBackendBaseUrl().replace(/^http/, "ws");
  const wsOrigin = cleanOrigin(
    process.env.NEXT_PUBLIC_BACKEND_WS_ORIGIN ?? defaultWsOrigin,
  );
  return `${wsOrigin}${cleanPath}`;
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
