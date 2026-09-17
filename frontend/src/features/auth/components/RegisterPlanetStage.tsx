"use client";

import {
  Suspense,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties } from "react";
import {
  AssetBoundary,
  CANVAS_SCALE,
  PlanetAssetGate,
  PlanetScene,
} from "@/components/space/PlanetBackground";
import { usePlanetPreference } from "@/components/space/PlanetPreferenceProvider";
import {
  PLANET_REGISTRY,
  SELECTABLE_PLANETS,
  type PlanetId,
  type PlanetTheme,
} from "@/components/space/modelsRegistry";
import usePlanetViewport from "@/components/space/usePlanetViewport";
import useReducedMotion from "@/components/space/useReducedMotion";
import styles from "./RegisterPlanetStage.module.css";

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

// Defers the 3D preview to after hydration, same intent (and mechanism) as
// PlanetBackground's own client-ready gate - the first GLTF fetch should
// never happen server-side.
function subscribeNever() {
  return () => undefined;
}

function useClientReady() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

export default function RegisterPlanetStage() {
  const {
    selectedPlanetId,
    selectedPlanet,
    planetModelEnabled,
    preferenceReady,
    themeStyle,
    selectPlanet,
  } = usePlanetPreference();
  const reducedMotion = useReducedMotion();
  const viewport = usePlanetViewport();
  const clientReady = useClientReady();
  const scrollRotation = useRef(0); // Register has no scroll-follow behavior.

  const [displayedPlanetId, setDisplayedPlanetId] =
    useState<PlanetId>(selectedPlanetId);

  const handleAssetReady = useCallback(
    (planetId: PlanetId) => {
      if (selectedPlanetId === planetId) {
        setDisplayedPlanetId(planetId);
      }
    },
    [selectedPlanetId],
  );

  const displayedPlanet = PLANET_REGISTRY[displayedPlanetId];
  // Respect the user's global "disable 3D" Settings toggle and skip the
  // heavy Canvas on mobile - the selector below still works either way.
  const showCanvas =
    clientReady &&
    preferenceReady &&
    planetModelEnabled &&
    viewport !== "mobile";

  return (
    <section
      className={styles.stage}
      style={themeStyle}
      aria-label="Choose your world"
    >
      <div className={styles.copy}>
        <h2 className={styles.heading}>Choose your world</h2>
        <p className={styles.hint}>You can change this anytime in Settings.</p>
      </div>

      <div
        className={styles.previewFrame}
        style={{ "--canvas-scale": CANVAS_SCALE } as CSSProperties}
      >
        {showCanvas ? (
          <>
            <AssetBoundary key={selectedPlanetId} label={selectedPlanet.label}>
              <Suspense fallback={null}>
                <PlanetAssetGate
                  config={selectedPlanet}
                  onReady={handleAssetReady}
                />
              </Suspense>
            </AssetBoundary>
            <div className={styles.canvasWrapper}>
              <PlanetScene
                config={displayedPlanet}
                viewport={viewport}
                reducedMotion={reducedMotion}
                scrollRotation={scrollRotation}
                entryFromSide="left"
              />
            </div>
          </>
        ) : (
          <div
            className={styles.orbFallback}
            style={createOptionStyle(selectedPlanet.theme)}
            aria-hidden="true"
          />
        )}
      </div>

      <div
        className={styles.selectorRow}
        role="group"
        aria-label="Planet themes"
      >
        {SELECTABLE_PLANETS.map((planet) => {
          const isSelected = planet.id === selectedPlanetId;
          return (
            <button
              key={planet.id}
              type="button"
              className={styles.planetOption}
              style={createOptionStyle(planet.theme)}
              aria-pressed={isSelected}
              onClick={() => selectPlanet(planet.id)}
            >
              <span className={styles.planetOrb} aria-hidden="true" />
              <span className={styles.planetLabel}>{planet.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
