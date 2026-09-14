/**
 * API & WebSocket configuration helper.
 * Configured for localhost on port 8080.
 */

export const BACKEND_PORT = 8080;

/**
 * Returns the backend hostname ("localhost").
 */
export function getBackendHost(): string {
  return "localhost";
}

/**
 * Returns the backend HTTP base URL ("http://localhost:8080").
 */
export function getBackendBaseUrl(): string {
  return `http://${getBackendHost()}:${BACKEND_PORT}`;
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
 * Returns the WebSocket URL ("ws://localhost:8080/api/ws").
 */
export function getWebSocketUrl(path: string = "/api/ws"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `ws://${getBackendHost()}:${BACKEND_PORT}${cleanPath}`;
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
