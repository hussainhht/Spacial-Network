// Shared fetch client for the Go backend's REST API. All requests are sent
// with credentials so the session cookie set by /api/login is included.

import { ApiError } from "./errors";
import { getApiUrl, getApiBaseUrl } from "../api";

export { getApiUrl, getApiBaseUrl };

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  // Let the browser set Content-Type (with boundary) for FormData bodies -
  // forcing application/json here would break multipart parsing server-side.
  const isFormData = init?.body instanceof FormData;

  try {
    response = await fetch(getApiUrl(path), {
      credentials: "include",
      ...init,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Could not connect to server", 0);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (data?.error) message = data.error;
    } catch {
      console.warn("Failed to parse error response as JSON:", text);
      // response had no JSON body
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
