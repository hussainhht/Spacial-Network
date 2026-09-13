"use client";

import { useState } from "react";
import Link from "next/link";
import { PLANETS, SUN, type SolarBodyId } from "../config/planets";
import { destinationForBody } from "../navigation/destinations";
import { useUniverseNavigation } from "../navigation/UniverseNavigationProvider";
import styles from "../styles/PlanetDock.module.css";

/** The Sun leads, then the planets outward. Derived from the same configuration
 * the scene is built from, so the bar can never list a body the system does not
 * contain — or miss one it does. */
const BODIES: readonly { id: SolarBodyId; name: string; glyph: string }[] = [
  { id: "sun", name: SUN.name, glyph: SUN.glyph },
  ...PLANETS.map(({ id, name, glyph }) => ({ id, name, glyph })),
];

/**
 * The bottom bar.
 *
 * A body with a destination is a real link to its section: a primary click hands
 * the navigation to the universe camera, which travels there and changes the
 * route on the way, while a modified click still opens the section in a new tab
 * like any link. The remaining bodies are still the visual prototype — selecting
 * one moves the highlight and nothing else — until their destinations exist.
 */
export default function PlanetDock() {
  const [selected, setSelected] = useState<SolarBodyId>("earth");
  const { navigate } = useUniverseNavigation();

  return (
    <div className={styles.dock}>
      <div
        className={styles.rail}
        role="group"
        aria-label="Bodies in this system"
      >
        {BODIES.map((body) => {
          const destination = destinationForBody(body.id);
          const label = (
            <>
              <span className={styles.glyph} aria-hidden="true">
                {body.glyph}
              </span>
              <span className={styles.name}>{body.name}</span>
            </>
          );

          if (destination) {
            return (
              <Link
                key={body.id}
                href={destination.route}
                scroll={false}
                className={styles.body}
                data-selected={body.id === selected}
                data-destination
                aria-label={`${body.name}: open ${destination.label}`}
                title={`Open ${destination.label}`}
                onNavigate={(event) => {
                  setSelected(body.id);
                  if (navigate(destination.route)) event.preventDefault();
                }}
              >
                {label}
              </Link>
            );
          }

          return (
            <button
              key={body.id}
              type="button"
              className={styles.body}
              data-selected={body.id === selected}
              aria-pressed={body.id === selected}
              onClick={() => setSelected(body.id)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
