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

export default function AppearanceSettings() {
  const {
    selectedPlanetId,
    selectedPlanet,
    planetModelEnabled,
    planetScrollFollowEnabled,
    selectPlanet,
    setPlanetModelEnabled,
    setPlanetScrollFollowEnabled,
  } = usePlanetPreference();

  return (
    <div className={styles.sectionStack}>
      <section className={styles.card} aria-labelledby="rendering-heading">
        <div className={styles.cardHeader}>
          <div>
            <h3 id="rendering-heading" className={styles.cardTitle}>
              3D Rendering
            </h3>
            <p className={styles.cardDescription}>
              Control WebGL rendering without changing your color theme.
            </p>
          </div>
          <span className={styles.statusPill} aria-live="polite">
            {planetModelEnabled ? "On" : "Off"}
          </span>
        </div>

        <label className={styles.modelToggle} data-enabled={planetModelEnabled}>
          <span className={styles.toggleText}>
            <strong>Show 3D model</strong>
            <span id="model-toggle-hint">
              {planetModelEnabled
                ? `Display the ${selectedPlanet.label} model in the background.`
                : `Keep the ${selectedPlanet.label} theme without the 3D model.`}
            </span>
          </span>
          <span className={styles.switchTrack} aria-hidden="true">
            <span className={styles.switchThumb} />
          </span>
          <input
            className={styles.srOnly}
            type="checkbox"
            checked={planetModelEnabled}
            aria-describedby="model-toggle-hint"
            onChange={(event) => setPlanetModelEnabled(event.target.checked)}
          />
        </label>

        <label
          className={styles.modelToggle}
          data-enabled={planetScrollFollowEnabled}
        >
          <span className={styles.toggleText}>
            <strong>Planet scroll movement</strong>
            <span id="planet-scroll-toggle-hint">
              Move the active planet in response to page scrolling.
            </span>
          </span>
          <span className={styles.switchTrack} aria-hidden="true">
            <span className={styles.switchThumb} />
          </span>
          <input
            className={styles.srOnly}
            type="checkbox"
            role="switch"
            checked={planetScrollFollowEnabled}
            aria-describedby="planet-scroll-toggle-hint"
            onChange={(event) =>
              setPlanetScrollFollowEnabled(event.target.checked)
            }
          />
        </label>
      </section>

      <section className={styles.card} aria-labelledby="planet-heading">
        <div className={styles.cardHeader}>
          <div>
            <h3 id="planet-heading" className={styles.cardTitle}>
              Planet Theme
            </h3>
            <p id="planet-hint" className={styles.cardDescription}>
              Choose the celestial palette used throughout your space.
            </p>
          </div>
          <span className={styles.statusPill}>{selectedPlanet.label}</span>
        </div>

        <fieldset className={styles.planetFieldset} aria-describedby="planet-hint">
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
                      <span>{selected ? "Selected" : "Select theme"}</span>
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
  );
}
