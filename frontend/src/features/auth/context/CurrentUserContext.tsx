"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CurrentUser } from "../types/auth";

interface CurrentUserContextValue {
  user: CurrentUser;
  updateCurrentUser: (patch: Partial<CurrentUser>) => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({
  initialUser,
  children,
}: {
  initialUser: CurrentUser;
  children: ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  const value = useMemo<CurrentUserContextValue>(() => ({
    user,
    updateCurrentUser: (patch) => setUser((current) => ({ ...current, ...patch })),
  }), [user]);

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (!context) throw new Error("useCurrentUser must be used inside AuthGuard");
  return context;
}
