"use client";

import { useId } from "react";
import { SPACE_MODELS } from "@/components/space/modelsRegistry";
import PlanetController from "@/components/space/PlanetController";
import { usePlanetPreference } from "@/features/planet-preference/context/PlanetPreferenceProvider";
import styles from "./SettingsPage.module.css";

export default function SettingsPage() {
  const { activePlanet, isReady, setActivePlanet } = usePlanetPreference();
  const headingId = useId();

  return (
    <main className="settings-page space-shell">
      <div className={styles.container}>
        <section className={styles.section} aria-labelledby={headingId}>
          <h2 id={headingId} className={styles.sectionTitle}>
            Appearance
          </h2>
          <p className={styles.sectionHint}>
            Choose the planet used across your space visuals.
          </p>

          <div className={styles.previewFrame}>
            {isReady && <PlanetController autoRotate className={styles.previewFill} />}
          </div>

          <div role="radiogroup" aria-label="Space model" className={styles.grid}>
            {SPACE_MODELS.map((model) => {
              const selected = isReady && activePlanet === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                  onClick={() => setActivePlanet(model.id)}
                >
                  {model.name}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
