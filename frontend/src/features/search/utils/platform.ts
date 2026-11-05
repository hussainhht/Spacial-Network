import { useSyncExternalStore } from "react";

interface NavigatorWithUAData extends Navigator {
  userAgentData?: { platform?: string };
}

/** Client-only. Returns false when `navigator` is unavailable. */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as NavigatorWithUAData;
  const platform =
    nav.userAgentData?.platform || nav.platform || nav.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

const subscribe = () => () => {};

/**
 * Hydration-safe: the server and first client render report `false`
 * (Ctrl), then React re-renders with the detected value after hydration.
 */
export function useIsApplePlatform(): boolean {
  return useSyncExternalStore(subscribe, isApplePlatform, () => false);
}

/** True when the platform's search modifier (⌘ on Apple, Ctrl elsewhere) is the only one held. */
export function hasSearchModifier(e: KeyboardEvent): boolean {
  return isApplePlatform()
    ? e.metaKey && !e.ctrlKey
    : e.ctrlKey && !e.metaKey;
}
