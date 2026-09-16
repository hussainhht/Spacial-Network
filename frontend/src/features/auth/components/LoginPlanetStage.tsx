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
import { PLANET_REGISTRY, type PlanetId, type PlanetTheme } from "@/components/space/modelsRegistry";
import usePlanetViewport from "@/components/space/usePlanetViewport";
import useReducedMotion from "@/components/space/useReducedMotion";
import styles from "./LoginPlanetStage.module.css";

type OrbStyle = CSSProperties & {
  "--option-accent": string;
  "--option-accent-hover": string;
  "--option-glow": string;
};

function createOrbStyle(theme: PlanetTheme): OrbStyle {
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

/**
 * Purely decorative companion to the login form - it displays whatever
 * planet the visitor already picked (via PlanetPreferenceProvider /
 * localStorage) with no selector of its own, so it never introduces a new
 * preference surface.
 */
export default function LoginPlanetStage() {
  const { selectedPlanetId, selectedPlanet, planetModelEnabled, preferenceReady, themeStyle } =
    usePlanetPreference();
  const reducedMotion = useReducedMotion();
  const viewport = usePlanetViewport();
  const clientReady = useClientReady();
  const scrollRotation = useRef(0); // Login has no scroll-follow behavior.

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
  // heavy Canvas on mobile.
  const showCanvas =
    clientReady &&
    preferenceReady &&
    planetModelEnabled &&
    viewport !== "mobile";

  return (
    <section className={styles.stage} style={themeStyle} aria-hidden="true">
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
            style={createOrbStyle(selectedPlanet.theme)}
          />
        )}
      </div>

      <div className={styles.copy}>
        <p className={styles.tagline}>Welcome back to your universe.</p>
        <p className={styles.hint}>Continue your journey.</p>
      </div>
    </section>
  );
}
