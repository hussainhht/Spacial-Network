"use client";

import { useSyncExternalStore } from "react";
import type { PlanetViewport } from "./modelsRegistry";

const MOBILE_QUERY = "(max-width: 760px)";
const TABLET_QUERY = "(max-width: 1100px)";

function subscribe(onStoreChange: () => void) {
  const mobile = window.matchMedia(MOBILE_QUERY);
  const tablet = window.matchMedia(TABLET_QUERY);
  mobile.addEventListener("change", onStoreChange);
  tablet.addEventListener("change", onStoreChange);
  return () => {
    mobile.removeEventListener("change", onStoreChange);
    tablet.removeEventListener("change", onStoreChange);
  };
}

function getSnapshot(): PlanetViewport {
  if (window.matchMedia(MOBILE_QUERY).matches) return "mobile";
  if (window.matchMedia(TABLET_QUERY).matches) return "tablet";
  return "desktop";
}

function getServerSnapshot(): PlanetViewport {
  return "desktop";
}

export default function usePlanetViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
