"use client";

import { useState } from "react";
import { PLANETS, SUN, type SolarBodyId } from "../config/planets";
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
 * A visual prototype: selecting an entry moves the highlight and nothing else.
 * It holds its own selection in local state on purpose — the bar is where the
 * fast-travel controls will live, and this is the shape of them, but none of the
 * navigation, camera travel or routing behind it exists yet, and wiring it into
 * the scene now would be inventing the interaction model before it is designed.
 */
export default function PlanetDock() {
  const [selected, setSelected] = useState<SolarBodyId>("earth");

  return (
    <div className={styles.dock}>
      <div
        className={styles.rail}
        role="group"
        aria-label="Bodies in this system"
      >
        {BODIES.map((body) => (
          <button
            key={body.id}
            type="button"
            className={styles.body}
            data-selected={body.id === selected}
            aria-pressed={body.id === selected}
            onClick={() => setSelected(body.id)}
          >
            <span className={styles.glyph} aria-hidden="true">
              {body.glyph}
            </span>
            <span className={styles.name}>{body.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
