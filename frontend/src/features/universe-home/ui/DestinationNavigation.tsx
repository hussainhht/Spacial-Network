"use client";

import Link from "next/link";
import type { HomeMotionController, UniverseHomeAPI } from "../contracts";
import { PLANET_DESTINATIONS } from "../navigation/planetDestinations";
import styles from "../UniverseHome.module.css";

type Props = Pick<UniverseHomeAPI, "activePlanetId" | "selectedPlanetId" | "selectPlanet"> &
  Pick<HomeMotionController, "goToPlanet"> & { canFocus: boolean };

export default function DestinationNavigation({
  activePlanetId,
  selectedPlanetId,
  selectPlanet,
  goToPlanet,
  canFocus,
}: Props) {
  return (
    <nav className={styles.destinations} aria-label="Universe destinations" data-universe-ui>
      <ul className={styles.destinationList}>
        {PLANET_DESTINATIONS.map((destination) => (
          <li
            key={destination.id}
            className={styles.destination}
            data-active={activePlanetId === destination.id}
            data-selected={selectedPlanetId === destination.id}
          >
            <button
              type="button"
              className={styles.focusButton}
              aria-label={`Focus ${destination.label}`}
              aria-current={activePlanetId === destination.id ? "true" : undefined}
              disabled={!canFocus}
              onClick={() => goToPlanet(destination.id)}
            >
              <span className={styles.marker} aria-hidden="true" />
              {destination.label}
            </button>
            <Link
              href={destination.href}
              className={styles.destinationLink}
              onNavigate={() => selectPlanet(destination.id)}
            >
              Open {destination.sectionLabel}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
