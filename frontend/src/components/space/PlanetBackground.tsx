"use client";

import {
  Component,
  Suspense,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
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
const SCROLL_ROTATION_RADIANS_PER_PIXEL = 0.0018;

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

function PlanetScene({
  config,
  viewport,
  reducedMotion,
  scrollRotation,
}: {
  config: PlanetConfig;
  viewport: PlanetViewport;
  reducedMotion: boolean;
  scrollRotation: RefObject<number>;
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
        />
        <Suspense fallback={null}>
          <PlanetSystem
            key={config.id}
            config={config}
            viewport={viewport}
            reducedMotion={reducedMotion}
            scrollRotation={scrollRotation}
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
  const scrollRotation = useRef(0);

  useEffect(() => {
    if (reducedMotion) return;
    const scrollPane = document.getElementById("page-content");
    if (!scrollPane) return;

    let previousScrollTop = scrollPane.scrollTop;
    const handleScroll = () => {
      const nextScrollTop = scrollPane.scrollTop;
      const scrollDelta = nextScrollTop - previousScrollTop;
      previousScrollTop = nextScrollTop;
      scrollRotation.current +=
        scrollDelta * SCROLL_ROTATION_RADIANS_PER_PIXEL;
    };

    scrollPane.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollPane.removeEventListener("scroll", handleScroll);
  }, [reducedMotion]);

  const handleAssetReady = useCallback(
    (planetId: PlanetId) => {
      if (selectedPlanetId === planetId) {
        setDisplayedPlanetId(planetId);
      }
    },
    [selectedPlanetId],
  );

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
            scrollRotation={scrollRotation}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(PlanetBackground);
