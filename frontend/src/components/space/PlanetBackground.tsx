"use client";

import { Component, Suspense, memo, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import EarthSystem from "./EarthSystem";
import { SUN_POSITION } from "./earthMaterials";
import useReducedMotion from "./useReducedMotion";
import styles from "./PlanetBackground.module.css";

// The canvas is rendered larger than Earth's own on-screen footprint (see
// .planetCanvasWrapper) so the Moon's orbit has room to clear the frustum
// edge. The camera is moved back by the same factor the canvas grows by,
// which keeps Earth's (and the Moon's) apparent size/position on screen
// unchanged - it only grows the margin around them.
const CANVAS_SCALE = 1.6;

const CAMERA = {
  position: [0, 0, 4 * CANVAS_SCALE] as [number, number, number],
  fov: 45,
  near: 0.01,
  far: 100,
};

interface SceneBoundaryState {
  failed: boolean;
}

class SceneBoundary extends Component<
  { children: ReactNode },
  SceneBoundaryState
> {
  state: SceneBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("PlanetBackground: Earth scene failed to render.", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function EarthScene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <Canvas
      camera={CAMERA}
      dpr={[1, 2]}
      frameloop={reducedMotion ? "demand" : "always"}
      fallback={null}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      shadows={false}
    >
      <ambientLight intensity={0.12} />
      <directionalLight position={SUN_POSITION} intensity={3} />
      <Suspense fallback={null}>
        <EarthSystem reducedMotion={reducedMotion} />
      </Suspense>
    </Canvas>
  );
}

function PlanetBackground() {
  const reducedMotion = useReducedMotion();

  return (
    <div
      data-earth-background
      className={styles.planetLayer}
      aria-hidden="true"
    >
      <div className={styles.planetFrame}>
        <div className={styles.planetCanvasWrapper}>
          <SceneBoundary>
            <EarthScene reducedMotion={reducedMotion} />
          </SceneBoundary>
        </div>
      </div>
    </div>
  );
}

export default memo(PlanetBackground);
