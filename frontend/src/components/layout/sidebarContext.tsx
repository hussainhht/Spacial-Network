"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface SidebarContextValue {
  isOpen: boolean;
  isReady: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

const STORAGE_KEY = "social_network_sidebar_state";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "closed") {
        setIsOpen(false);
      } else if (saved === "open") {
        setIsOpen(true);
      }
    } catch {
      // Ignore localStorage access issues (e.g. private browsing)
    }
    setIsReady(true);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
      } catch {
        // Ignore localStorage access issues
      }
      return next;
    });
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    try {
      localStorage.setItem(STORAGE_KEY, "open");
    } catch {
      // Ignore localStorage access issues
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "closed");
    } catch {
      // Ignore localStorage access issues
    }
  }, []);

  return (
    <SidebarContext.Provider value={{ isOpen, isReady, toggle, open, close }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
