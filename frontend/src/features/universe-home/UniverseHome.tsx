"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import {
  useUniverseHome,
  useUniverseTransition,
} from "@/features/universe-transition/UniverseTransitionProvider";
import { useUniverseHomeMotion } from "./motion/useUniverseHomeMotion";
import { PLANET_DESTINATIONS } from "./navigation/planetDestinations";
import DestinationNavigation from "./ui/DestinationNavigation";
import styles from "./UniverseHome.module.css";

export default function UniverseHome() {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const home = useUniverseHome();
  const { register } = useUniverseTransition();
  const observeRoot = useCallback((element: HTMLElement | null) => {
    setRoot(element);
    setScroller(element?.closest<HTMLElement>("#page-content") ?? null);
  }, []);

  // Measure the actual shell pane, including its responsive navbar reservation.
  // The root remains free to grow when motion adds its pin spacer.
  useLayoutEffect(() => {
    if (!root || !scroller) return;
    const measure = () => {
      root.style.setProperty("--universe-pane-height", `${scroller.clientHeight}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [root, scroller]);

  const { pause, resume, goToPlanet } = useUniverseHomeMotion({
    root,
    viewport,
    scroller,
    scene: home.scene,
    reducedMotion: home.reducedMotion,
    enabled: !home.isTransitioning,
    progressRef: home.homeProgress,
    onProgress: home.reportHomeProgress,
  });

  useLayoutEffect(() => {
    if (!root) return;
    return register("/", { root, pause, resume });
  }, [root, register, pause, resume]);

  const active = PLANET_DESTINATIONS.find(({ id }) => id === home.activePlanetId);

  return (
    <main
      ref={observeRoot}
      className={styles.home}
      aria-labelledby="app-page-title"
      data-universe-scene="home"
      data-active-planet={home.activePlanetId}
      data-selected-planet={home.selectedPlanetId ?? undefined}
    >
      <div ref={setViewport} className={styles.viewport} data-universe-viewport>
        <div className={styles.caption} data-universe-ui>
          <h2 className={styles.planetName} aria-live="polite" aria-atomic="true">
            {active?.label}
          </h2>
          <p className={styles.hint}>Scroll to explore, or choose a destination.</p>
        </div>
        <DestinationNavigation
          activePlanetId={home.activePlanetId}
          selectedPlanetId={home.selectedPlanetId}
          canFocus={home.scene !== null && !home.isTransitioning}
          goToPlanet={goToPlanet}
          selectPlanet={home.selectPlanet}
        />
      </div>
    </main>
  );
}
