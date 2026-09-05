"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiUrl } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch(getApiUrl("/logout"), {
        method: "POST",
        credentials: "include",
      });
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Social Network</h1>
      <p>Frontend is working.</p>

      <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", alignItems: "center" }}>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            padding: "8px 16px",
            background: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>

        <a href="/chat" style={{ color: "#2563eb" }}>
          Go to Chat
        </a>
      </div>
    </main>
  );
}
