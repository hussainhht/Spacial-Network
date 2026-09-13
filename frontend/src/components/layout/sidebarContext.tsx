"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

interface SidebarContextValue {
  isOpen: boolean;
  isReady: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);
const STORAGE_KEY = "social_network_sidebar_state";
const CHANGE_EVENT = "sidebar-preference-change";
let fallbackOpen = true;

function readPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "closed";
  } catch {
    return fallbackOpen;
  }
}

function serverPreference(): null {
  return null;
}

function subscribe(listener: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

function toggle() {
  fallbackOpen = !readPreference();
  try {
    localStorage.setItem(STORAGE_KEY, fallbackOpen ? "open" : "closed");
  } catch {
    // Keep the control usable when persistent storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(subscribe, readPreference, serverPreference);
  return (
    <SidebarContext.Provider value={{ isOpen: preference ?? true, isReady: preference !== null, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider");
  return context;
}
