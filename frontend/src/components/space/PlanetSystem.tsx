"use client";

import {
  Component,
  Suspense,
  useMemo,
  type ReactNode,
  type RefObject,
} from "react";
import PlanetModel from "./PlanetModel";
import {
  AxialRotation,
  OrbitingCompanion,
  PlanetEntrance,
  PlanetIdleMotion,
} from "./PlanetMotion";
import {
  MOON_COMPANION,
  type PlanetConfig,
  type PlanetViewport,
} from "./modelsRegistry";

class CompanionBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("PlanetSystem: Moon failed to render.", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function MoonCompanion({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <OrbitingCompanion
      reducedMotion={reducedMotion}
      radius={MOON_COMPANION.orbitRadius}
      radiansPerSecond={MOON_COMPANION.orbitRadiansPerSecond}
      initialPhase={MOON_COMPANION.initialPhase}
      inclination={MOON_COMPANION.inclination}
      planeRotation={MOON_COMPANION.planeRotation}
    >
      <group scale={MOON_COMPANION.scale}>
        <PlanetModel modelConfig={MOON_COMPANION.model} />
      </group>
    </OrbitingCompanion>
  );
}

export default function PlanetSystem({
  config,
  viewport,
  reducedMotion,
  scrollRotation,
  entryFromSide = "right",
}: {
  config: PlanetConfig;
  viewport: PlanetViewport;
  reducedMotion: boolean;
  scrollRotation: RefObject<number>;
  /** Which side the body enters from on mount. Defaults to "right",
   * matching the existing shell-background usage. */
  entryFromSide?: "left" | "right";
}) {
  const composition = useMemo(() => {
    const responsive = config.scene.responsive[viewport];
    const position: [number, number, number] = [
      config.scene.position[0] + responsive.positionOffset[0],
      config.scene.position[1] + responsive.positionOffset[1],
      config.scene.position[2] + responsive.positionOffset[2],
    ];
    const rotation: [number, number, number] = [...config.scene.rotation];
    return {
      position,
      rotation,
      scale: responsive.scaleMultiplier,
      offscreenRadius:
        config.scene.offscreenRadius * responsive.scaleMultiplier,
    };
  }, [config, viewport]);

  return (
    <PlanetEntrance
      reducedMotion={reducedMotion}
      offscreenRadius={composition.offscreenRadius}
      fromSide={entryFromSide}
    >
      <PlanetIdleMotion
        reducedMotion={reducedMotion}
        amplitude={config.scene.idleAmplitude}
      >
        <group
          position={composition.position}
          rotation={composition.rotation}
          scale={composition.scale}
        >
          <AxialRotation
            reducedMotion={reducedMotion}
            radiansPerSecond={config.scene.spinRadiansPerSecond}
            scrollRotation={scrollRotation}
          >
            <group scale={config.scene.bodyScale}>
              <PlanetModel modelConfig={config} />
            </group>
          </AxialRotation>
          {config.companion === "moon" ? (
            <CompanionBoundary>
              <Suspense fallback={null}>
                <MoonCompanion reducedMotion={reducedMotion} />
              </Suspense>
            </CompanionBoundary>
          ) : null}
        </group>
      </PlanetIdleMotion>
    </PlanetEntrance>
  );
}
