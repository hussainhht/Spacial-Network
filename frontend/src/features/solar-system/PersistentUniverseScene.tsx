"use client";

import { useLayoutEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { isUniverseRoute } from "./navigation/destinations";
import { useUniverseScene } from "./navigation/UniverseNavigationProvider";
import styles from "./styles/PersistentUniverseScene.module.css";

// Client-only. The scene measures its pane and creates a WebGL context, so
// there is nothing useful to prerender; the starfield behind it is server
// rendered, which is what the reader sees first.
const SolarSystemCanvas = dynamic(
  () => import("./components/SolarSystemCanvas"),
  { ssr: false },
);

/**
 * The solar system, mounted once for every route of the persistent universe.
 *
 * It lives in the app shell, behind the route content and in the same box, so
 * Home and Posts are two overlays on one scene rather than two pages with a
 * scene each: moving between them never unloads a model, never creates a second
 * WebGL context and never resizes the canvas. Pages do not reach into it — the
 * camera follows `UniverseNavigationProvider`, and the pages show their own UI
 * through `useDestinationPresence`.
 *
 * On any other route it is not mounted at all.
 */
export default function PersistentUniverseScene() {
  return isUniverseRoute(usePathname()) ? <UniverseLayer /> : null;
}

function UniverseLayer() {
  const { rigRef, bindSceneLayer, reportPane } = useUniverseScene();
  const reducedMotion = useReducedMotion();
  const layer = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = layer.current;
    if (!element) return;
    bindSceneLayer(element);
    const observer = new ResizeObserver(([entry]) =>
      reportPane(entry.contentRect.width, entry.contentRect.height),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      bindSceneLayer(null);
    };
  }, [bindSceneLayer, reportPane]);

  return (
    <div ref={layer} className={styles.layer}>
      <SolarSystemCanvas reducedMotion={reducedMotion} rigRef={rigRef} />
    </div>
  );
}
