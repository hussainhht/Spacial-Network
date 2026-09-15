"use client";

import { useSyncExternalStore } from "react";
import WhoToFollow from "./WhoToFollow";
import SuggestedGroups from "./SuggestedGroups";
import styles from "./HomeDiscovery.module.css";

const desktopQuery = "(min-width: 1280px)";

function subscribe(callback: () => void) {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(desktopQuery).matches;
}

function getServerSnapshot() {
  return false;
}

export default function HomeDiscovery({
  placement,
}: {
  placement: "desktop" | "inline";
}) {
  const isDesktop = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if ((placement === "desktop") !== isDesktop) return null;

  return (
    <div className={styles.stack} aria-label="Discover people and groups">
      <div className={`${styles.cards} ${placement === "inline" ? styles.inline : ""}`}>
        <WhoToFollow limit={3} />
        <SuggestedGroups limit={2} />
      </div>
    </div>
  );
}
