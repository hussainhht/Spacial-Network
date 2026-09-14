"use client";

import type { CSSProperties } from "react";
import { usePlanetPreference } from "@/components/space/PlanetPreferenceProvider";
import {
  SELECTABLE_PLANETS,
  type PlanetTheme,
} from "@/components/space/modelsRegistry";
import styles from "./SettingsPage.module.css";

type OptionStyle = CSSProperties & {
  "--option-accent": string;
  "--option-accent-hover": string;
  "--option-glow": string;
};

function createOptionStyle(theme: PlanetTheme): OptionStyle {
  return {
    "--option-accent": theme.accent,
    "--option-accent-hover": theme.accentHover,
    "--option-glow": theme.glow,
  };
}

export default function SettingsPage() {
  const { selectedPlanetId, selectedPlanet, selectPlanet } =
    usePlanetPreference();

  return (
    <main className="settings-page space-shell" aria-labelledby="app-page-title">
      <div className={styles.container}>
        <section className={styles.section} aria-labelledby="planet-heading">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="planet-heading" className={styles.sectionTitle}>
                Planet
              </h2>
              <p id="planet-hint" className={styles.sectionHint}>
                Choose the celestial body and accent used across your space.
              </p>
            </div>
            <span className={styles.currentPlanet} aria-live="polite">
              {selectedPlanet.label} active
            </span>
          </div>

          <fieldset
            className={styles.planetFieldset}
            aria-describedby="planet-hint"
          >
            <legend className={styles.srOnly}>Active celestial body</legend>
            <div className={styles.planetGrid}>
              {SELECTABLE_PLANETS.map((planet) => {
                const selected = planet.id === selectedPlanetId;
                return (
                  <label
                    key={planet.id}
                    className={styles.planetOption}
                    style={createOptionStyle(planet.theme)}
                  >
                    <input
                      className={styles.planetRadio}
                      type="radio"
                      name="active-planet"
                      value={planet.id}
                      checked={selected}
                      onChange={() => selectPlanet(planet.id)}
                    />
                    <span className={styles.optionCard}>
                      <span className={styles.planetOrb} aria-hidden="true" />
                      <span className={styles.optionText}>
                        <strong>{planet.label}</strong>
                        <span>{selected ? "Selected" : "Select"}</span>
                      </span>
                      <span className={styles.checkmark} aria-hidden="true">
                        ✓
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </section>
      </div>
    </main>
  );
}
