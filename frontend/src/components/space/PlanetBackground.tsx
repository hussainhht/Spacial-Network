"use client";

import { Component, Suspense, memo, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import PlanetModel from "./PlanetModel";
import { EARTH_MODEL } from "./modelsRegistry";
import { SUN_POSITION } from "./earthMaterials";
import styles from "./PlanetBackground.module.css";

const CAMERA = {
  position: [0, 0, 4] as [number, number, number],
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

function EarthScene() {
  return (
    <Canvas
      camera={CAMERA}
      dpr={[1, 2]}
      frameloop="demand"
      fallback={null}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      shadows={false}
    >
      <ambientLight intensity={0.12} />
      <directionalLight position={SUN_POSITION} intensity={3} />
      <Suspense fallback={null}>
        <group scale={2.2}>
          <PlanetModel modelConfig={EARTH_MODEL} />
        </group>
      </Suspense>
    </Canvas>
  );
}

function PlanetBackground() {
  return (
    <div
      data-earth-background
      className={styles.planetLayer}
      aria-hidden="true"
    >
      <div className={styles.planetFrame}>
        <SceneBoundary>
          <EarthScene />
        </SceneBoundary>
      </div>
    </div>
  );
}

export default memo(PlanetBackground);
