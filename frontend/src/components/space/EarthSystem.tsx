"use client";

import { Component, Suspense, type ReactNode } from "react";
import PlanetModel from "./PlanetModel";
import {
  AxialRotation,
  OrbitingCompanion,
  PlanetEntrance,
  PlanetIdleMotion,
} from "./PlanetMotion";
import { EARTH_MODEL, MOON_MODEL } from "./modelsRegistry";

const EARTH_SYSTEM_SCALE = 2.2;
const EARTH_ROTATION_SPEED = 0.018;
const MOON_ORBIT_RADIUS = 1.5;
const MOON_ORBIT_SPEED = 0.055;
const MOON_SCALE = 0.18;

class CompanionBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("EarthSystem: Moon failed to render.", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function MoonCompanion({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <OrbitingCompanion
      reducedMotion={reducedMotion}
      radius={MOON_ORBIT_RADIUS}
      radiansPerSecond={MOON_ORBIT_SPEED}
      initialPhase={-2.85}
      inclination={0.3}
      planeRotation={-0.12}
    >
      <group scale={MOON_SCALE}>
        <PlanetModel modelConfig={MOON_MODEL} />
      </group>
    </OrbitingCompanion>
  );
}

export default function EarthSystem({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) {
  return (
    <PlanetEntrance reducedMotion={reducedMotion}>
      <PlanetIdleMotion reducedMotion={reducedMotion}>
        <group>
          <AxialRotation
            reducedMotion={reducedMotion}
            radiansPerSecond={EARTH_ROTATION_SPEED}
          >
            <group scale={EARTH_SYSTEM_SCALE}>
              <PlanetModel modelConfig={EARTH_MODEL} />
            </group>
          </AxialRotation>
          <CompanionBoundary>
            <Suspense fallback={null}>
              <MoonCompanion reducedMotion={reducedMotion} />
            </Suspense>
          </CompanionBoundary>
        </group>
      </PlanetIdleMotion>
    </PlanetEntrance>
  );
}
