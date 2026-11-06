"use client";

import { requestFetch } from "@/demo/api";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api";
import { resetSavedPosts } from "@/features/saved/savedPostsStore";

export function useLogout() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function logout() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setLoggingOut(true);
    try {
      const response = await requestFetch(getApiUrl("/logout"), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok && response.status !== 401) {
        throw new Error("Could not log out. Please try again.");
      }
      resetSavedPosts();
      router.replace("/login");
    } catch {
      setError("Could not log out. Please try again.");
    } finally {
      inFlight.current = false;
      setLoggingOut(false);
    }
  }

  return { logout, loggingOut, error };
}
