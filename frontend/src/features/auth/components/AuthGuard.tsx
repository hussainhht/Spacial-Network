"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "../api/getCurrentUser";
import { CurrentUserProvider } from "../context/CurrentUserContext";
import type { CurrentUser } from "../types/auth";

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

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

      setCurrentUser(user);
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!currentUser) {
    return null;
  }

  return <CurrentUserProvider initialUser={currentUser}>{children}</CurrentUserProvider>;
}
