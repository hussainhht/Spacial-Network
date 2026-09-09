import { apiRequest } from "@/lib/api/client";
import type { CurrentUser } from "../types/auth";

/**
 * Checks the active session and retrieves the current user's ID.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const data = await apiRequest<CurrentUser>("/login", { method: "GET" });
    if (data?.user_id) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}
