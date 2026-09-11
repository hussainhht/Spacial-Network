"use client";

import Link from "next/link";
import type { HomeMotionController, PlanetId, UniverseHomeAPI } from "../contracts";
import { PLANET_DESTINATIONS } from "../navigation/planetDestinations";
import styles from "../UniverseHome.module.css";

type Props = Pick<UniverseHomeAPI, "activePlanetId" | "selectedPlanetId"> &
  Pick<HomeMotionController, "goToPlanet"> & {
    canFocus: boolean;
    /** Opens a destination. Returns true when the cinematic claimed the move, in
     * which case the Link must not navigate as well — the transition pushes the
     * route itself, part way through. */
    openDestination: (id: PlanetId) => boolean;
  };

export default function DestinationNavigation({
  activePlanetId,
  selectedPlanetId,
  goToPlanet,
  canFocus,
  openDestination,
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
              onNavigate={(event) => {
                if (openDestination(destination.id)) event.preventDefault();
              }}
            >
              Open {destination.sectionLabel}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
