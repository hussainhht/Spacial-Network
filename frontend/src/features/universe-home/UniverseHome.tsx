"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useUniverseHome,
  useUniverseTransition,
} from "@/features/universe-transition/UniverseTransitionProvider";
import type { PlanetId } from "./contracts";
import { useUniverseHomeMotion } from "./motion/useUniverseHomeMotion";
import {
  getPlanetDestination,
  PLANET_DESTINATIONS,
} from "./navigation/planetDestinations";
import DestinationNavigation from "./ui/DestinationNavigation";
import styles from "./UniverseHome.module.css";

/**
 * The homepage is one locked pane, not a scrolling document. It owns the whole
 * shell pane, never grows past it, and turns gestures into loop steps instead
 * of page scroll — so there is no second scrollbar and no pin spacer.
 */
export default function UniverseHome() {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const home = useUniverseHome();
  const { register, navigate } = useUniverseTransition();
  const router = useRouter();

  const { pause, resume, goToPlanet } = useUniverseHomeMotion({
    root,
    phase: home.phase,
    scene: home.scene,
    reducedMotion: home.reducedMotion,
    enabled: !home.isTransitioning,
    onCommit: home.commitActivePlanet,
  });

  useLayoutEffect(() => {
    if (!root) return;
    return register("/", { root, pause, resume });
  }, [root, register, pause, resume]);

  // Exploring and opening stay separate: a click on a neighbour brings it into
  // focus, and only a click on the planet already in focus opens its section.
  const activePlanetId = home.activePlanetId;
  const { selectPlanet, setPlanetActivateHandler } = home;
  useLayoutEffect(() => {
    return setPlanetActivateHandler((id: PlanetId) => {
      if (id !== activePlanetId) {
        goToPlanet(id);
        return;
      }
      const { href } = getPlanetDestination(id);
      selectPlanet(id);
      // Defer to the route cinematic when it is enabled; it declines under v1
      // and ordinary client navigation takes over.
      if (!navigate(href)) router.push(href);
    });
  }, [
    setPlanetActivateHandler,
    activePlanetId,
    goToPlanet,
    selectPlanet,
    navigate,
    router,
  ]);

  const active = PLANET_DESTINATIONS.find(({ id }) => id === activePlanetId);

  return (
    <main
      ref={setRoot}
      className={styles.home}
      aria-labelledby="app-page-title"
      data-universe-scene="home"
      data-active-planet={activePlanetId}
      data-selected-planet={home.selectedPlanetId ?? undefined}
    >
      <div className={styles.viewport} data-universe-viewport>
        <div className={styles.caption} data-universe-ui>
          <h2
            key={activePlanetId}
            className={styles.planetName}
            aria-live="polite"
            aria-atomic="true"
          >
            {active?.label}
          </h2>
          <p className={styles.hint}>
            Scroll or swipe to travel the system, or choose a destination.
          </p>
        </div>
        <DestinationNavigation
          activePlanetId={activePlanetId}
          selectedPlanetId={home.selectedPlanetId}
          canFocus={home.scene !== null && !home.isTransitioning}
          goToPlanet={goToPlanet}
          selectPlanet={selectPlanet}
        />
      </div>
    </main>
  );
}
