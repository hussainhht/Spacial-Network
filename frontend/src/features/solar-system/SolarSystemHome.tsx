"use client";

import dynamic from "next/dynamic";
import PlanetDock from "./components/PlanetDock";
import { useReducedMotion } from "./hooks/useReducedMotion";
import styles from "./styles/SolarSystemHome.module.css";

// Client-only. The scene measures its pane and creates a WebGL context, so
// there is nothing useful to prerender; the starfield behind it is server
// rendered, which is what the reader sees first.
const SolarSystemCanvas = dynamic(
  () => import("./components/SolarSystemCanvas"),
  { ssr: false },
);

/**
 * The home page: one locked pane holding the solar system.
 *
 * Phase 1 — the composition only. The scene is fixed and ambient: it turns, it
 * never travels, and nothing in it is a control. The chrome is deliberately
 * thin, two lines of type and the dock, because the planets are the page.
 */
export default function SolarSystemHome() {
  const reducedMotion = useReducedMotion();

  return (
    <main
      className={styles.home}
      aria-labelledby="app-page-title"
      data-solar-scene="home"
    >
      <div className={styles.viewport}>
        <SolarSystemCanvas reducedMotion={reducedMotion} />
        <div className={styles.caption}>
          <h2 className={styles.title}>Your solar system</h2>
          <p className={styles.subtitle}>
            Every destination in the network orbits the same star.
          </p>
        </div>
        <PlanetDock />
      </div>
    </main>
  );
}
