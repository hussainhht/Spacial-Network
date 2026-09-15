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
  const {
    selectedPlanetId,
    selectedPlanet,
    planetModelEnabled,
    selectPlanet,
    setPlanetModelEnabled,
  } = usePlanetPreference();

  return (
    <main className="settings-page space-shell" aria-labelledby="app-page-title">
      <div className={styles.container}>
        <section className={styles.section} aria-labelledby="planet-heading" data-motion-section>
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="planet-heading" className={styles.sectionTitle}>
                Planet
              </h2>
              <p id="planet-hint" className={styles.sectionHint}>
                Choose the celestial theme used across your space, with or
                without its 3D model.
              </p>
            </div>
            <span className={styles.currentPlanet} aria-live="polite">
              {selectedPlanet.label} theme · 3D{" "}
              {planetModelEnabled ? "on" : "off"}
            </span>
          </div>

          <label
            className={styles.modelToggle}
            data-enabled={planetModelEnabled}
          >
            <span className={styles.toggleText}>
              <strong>Show 3D model</strong>
              <span id="model-toggle-hint">
                {planetModelEnabled
                  ? `Display the ${selectedPlanet.label} model.`
                  : `Keep the ${selectedPlanet.label} theme without WebGL rendering.`}
              </span>
            </span>
            <input
              className={styles.modelCheckbox}
              type="checkbox"
              checked={planetModelEnabled}
              aria-describedby="model-toggle-hint"
              onChange={(event) => setPlanetModelEnabled(event.target.checked)}
            />
          </label>

          <fieldset
            className={styles.planetFieldset}
            aria-describedby="planet-hint"
          >
            <legend className={styles.srOnly}>Planet appearance</legend>
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
