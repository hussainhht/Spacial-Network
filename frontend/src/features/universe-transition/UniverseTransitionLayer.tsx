"use client";

import type { Ref } from "react";
import styles from "./UniverseTransition.module.css";

/** The stable portal host is parked here between routes; the light bridges
 * destination loading without replacing either page's existing background. */
export default function UniverseTransitionLayer({
  layerRef,
  glowRef,
}: {
  layerRef: Ref<HTMLDivElement>;
  glowRef: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={layerRef} className={styles.layer} aria-hidden="true">
      <div ref={glowRef} className={styles.glow}>
        ✦
      </div>
    </div>
  );
}
