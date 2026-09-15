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
import { Canvas, useThree } from "@react-three/fiber";
import PlanetSystem from "./PlanetSystem";
import { SUN_POSITION } from "./earthMaterials";
import {
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
const CANVAS_SCALE = 2.6;

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

/**
 * FrameGovernor
 * 
 * Regulates the WebGL render loop:
 * 1. Caps frame rate at ~50 FPS (saves 58% GPU cycles over 120Hz ProMotion displays).
 * 2. Pauses rendering completely (0 FPS) when tab is hidden or minimized.
 * 3. Renders only a single frame when reducedMotion is enabled.
 */
function FrameGovernor({
  fps = 50,
  reducedMotion,
}: {
  fps?: number;
  reducedMotion: boolean;
}) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (reducedMotion) {
      invalidate();
      return;
    }

    let animId: number;
    let lastTime = 0;
    const interval = 1000 / fps;

    function tick(now: number) {
      animId = requestAnimationFrame(tick);
      if (typeof document !== "undefined" && document.hidden) return;

      const elapsed = now - lastTime;
      if (elapsed >= interval) {
        lastTime = now - (elapsed % interval);
        invalidate();
      }
    }

    animId = requestAnimationFrame(tick);

    function handleVisibilityChange() {
      if (!document.hidden) {
        lastTime = performance.now();
        invalidate();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fps, invalidate, reducedMotion]);

  return null;
}

import PlanetTransition from "./PlanetTransition";

function PlanetScene({
  config,
  targetConfig,
  isTargetReady,
  viewport,
  reducedMotion,
}: {
  config: PlanetConfig;
  targetConfig: PlanetConfig;
  isTargetReady: boolean;
  viewport: PlanetViewport;
  reducedMotion: boolean;
}) {
  return (
    <Canvas
      camera={CAMERA}
      dpr={[1, 1.25]}
      frameloop="demand"
      fallback={null}
      gl={{ alpha: true, antialias: true, powerPreference: "default" }}
      shadows={false}
    >
      <FrameGovernor fps={50} reducedMotion={reducedMotion} />
      <SceneBoundary key={config.id} label={config.label}>
        <ambientLight intensity={config.lighting.ambientIntensity} />
        <directionalLight
          position={SUN_POSITION}
          intensity={config.lighting.directionalIntensity}
      <SceneBoundary label="Planet Scene">
        <PlanetTransition
          targetConfig={targetConfig}
          isTargetReady={isTargetReady}
          viewport={viewport}
          reducedMotion={reducedMotion}
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
    useState<PlanetId>(selectedPlanetId);

  // Track the latest asset that has confirmed ready in cache
  const [readyPlanetId, setReadyPlanetId] = useState<PlanetId>(selectedPlanetId);

  const handleAssetReady = useCallback((planetId: PlanetId) => {
    if (selectedPlanetId === planetId) {
      setDisplayedPlanetId(planetId);
    }
  }, [selectedPlanetId]);
    setReadyPlanetId(planetId);
  }, []);

  const displayedPlanet = PLANET_REGISTRY[displayedPlanetId];
  const isTargetReady = readyPlanetId === selectedPlanetId;

  return (
    <div
      data-planet-background={displayedPlanetId}
      data-planet-background={selectedPlanetId}
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
            targetConfig={selectedPlanet}
            isTargetReady={isTargetReady}
            viewport={viewport}
            reducedMotion={reducedMotion}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(PlanetBackground);
