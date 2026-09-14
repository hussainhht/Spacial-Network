"use client";

import {
  Component,
  Suspense,
  memo,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import PlanetSystem from "./PlanetSystem";
import { SUN_POSITION } from "./earthMaterials";
import {
  DEFAULT_PLANET_ID,
  PLANET_REGISTRY,
  type PlanetConfig,
  type PlanetId,
  type PlanetViewport,
} from "./modelsRegistry";
import { usePlanetPreference } from "./PlanetPreferenceProvider";
import usePlanetViewport from "./usePlanetViewport";
import useReducedMotion from "./useReducedMotion";
import styles from "./PlanetBackground.module.css";

// The canvas is larger than the body's visible frame so Earth's Moon and
// Saturn's rings have transparent room at the edge. Moving the camera back by
// the same factor preserves the established apparent size.
const CANVAS_SCALE = 1.6;

const CAMERA = {
  position: [0, 0, 4 * CANVAS_SCALE] as [number, number, number],
  fov: 45,
  near: 0.01,
  far: 100,
};

function subscribeToClientReady() {
  return () => undefined;
}

function getClientReadySnapshot() {
  return true;
}

function getServerReadySnapshot() {
  return false;
}

class SceneBoundary extends Component<
  { children: ReactNode; label: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(
      `PlanetBackground: ${this.props.label} failed to render.`,
      error,
    );
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

class AssetBoundary extends Component<
  { children: ReactNode; label: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(
      `PlanetBackground: ${this.props.label} failed to load.`,
      error,
    );
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Loads only the requested source into useGLTF's shared cache. It renders no
 * Three object, so the currently displayed body remains the only active body.
 */
function PlanetAssetGate({
  config,
  onReady,
}: {
  config: PlanetConfig;
  onReady: (planetId: PlanetId) => void;
}) {
  useGLTF(config.modelPath);

  useEffect(() => {
    onReady(config.id);
  }, [config.id, onReady]);

  return null;
}

function PlanetScene({
  config,
  viewport,
  reducedMotion,
}: {
  config: PlanetConfig;
  viewport: PlanetViewport;
  reducedMotion: boolean;
}) {
  return (
    <Canvas
      camera={CAMERA}
      dpr={[1, 2]}
      frameloop={reducedMotion ? "demand" : "always"}
      fallback={null}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      shadows={false}
    >
      <SceneBoundary key={config.id} label={config.label}>
        <ambientLight intensity={config.lighting.ambientIntensity} />
        <directionalLight
          position={SUN_POSITION}
          intensity={config.lighting.directionalIntensity}
        />
        <Suspense fallback={null}>
          <PlanetSystem
            key={config.id}
            config={config}
            viewport={viewport}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      </SceneBoundary>
    </Canvas>
  );
}

function PlanetBackground() {
  const { selectedPlanetId, selectedPlanet } = usePlanetPreference();
  const reducedMotion = useReducedMotion();
  const viewport = usePlanetViewport();
  const clientReady = useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );
  const [displayedPlanetId, setDisplayedPlanetId] =
    useState<PlanetId>(DEFAULT_PLANET_ID);

  const handleAssetReady = useCallback((planetId: PlanetId) => {
    if (selectedPlanetId === planetId) {
      setDisplayedPlanetId(planetId);
    }
  }, [selectedPlanetId]);

  const displayedPlanet = PLANET_REGISTRY[displayedPlanetId];

  return (
    <div
      data-planet-background={displayedPlanetId}
      className={styles.planetLayer}
      aria-hidden="true"
    >
      {clientReady ? (
        <AssetBoundary key={selectedPlanetId} label={selectedPlanet.label}>
          <Suspense fallback={null}>
            <PlanetAssetGate
              config={selectedPlanet}
              onReady={handleAssetReady}
            />
          </Suspense>
        </AssetBoundary>
      ) : null}
      <div className={styles.planetFrame}>
        <div className={styles.planetCanvasWrapper}>
          <PlanetScene
            config={displayedPlanet}
            viewport={viewport}
            reducedMotion={reducedMotion}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(PlanetBackground);
