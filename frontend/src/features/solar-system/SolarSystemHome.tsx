"use client";

import { useRef } from "react";
import PlanetDock from "./components/PlanetDock";
import { useDestinationPresence } from "./navigation/useDestinationPresence";
import styles from "./styles/SolarSystemHome.module.css";

/**
 * The home page: the chrome over the whole solar system.
 *
 * The system itself is not in here. It is the persistent universe scene in the
 * app shell (`PersistentUniverseScene`), mounted behind Home and Posts alike, so
 * that selecting Earth travels through the scene instead of swapping it for
 * another. What Home owns is deliberately thin — two lines of type and the dock —
 * and it is shown only while the camera is framing the system.
 */
export default function SolarSystemHome() {
  const viewport = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const presence = useDestinationPresence("home", viewport, title);

  return (
    <main
      className={styles.home}
      aria-labelledby="app-page-title"
      data-solar-scene="home"
    >
      <div ref={viewport} className={styles.viewport} {...presence}>
        <div className={styles.caption}>
          <h2 ref={title} tabIndex={-1} className={styles.title}>
            Your solar system
          </h2>
          <p className={styles.subtitle}>
            Every destination in the network orbits the same star.
          </p>
        </div>
        <PlanetDock />
      </div>
    </main>
  );
}
