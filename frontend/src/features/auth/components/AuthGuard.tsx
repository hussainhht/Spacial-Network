"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "../api/getCurrentUser";

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const user = await getCurrentUser();

      if (cancelled) return;

      if (!user) {
        const next = window.location.pathname + window.location.search;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      setAuthenticated(true);
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!authenticated) {
    return null;
  }

  return children;
}