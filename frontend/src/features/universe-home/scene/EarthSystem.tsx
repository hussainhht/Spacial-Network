"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { EarthPlanetModel, GenericPlanetModel } from "@/components/space/DevPlanetModel";
import type { PhaseRef, StageRef } from "../contracts";
import { orbitNearness } from "../motion/orbitPath";
import PlanetAsset, { type AssetErrorReporter } from "./PlanetAsset";
import {
  EARTH_SYSTEM,
  MAX_FRAME_DELTA,
  SATELLITE_EMPHASIS,
  SCENE_MODELS,
  SPIN_SPEED,
} from "./sceneConfig";

export default function EarthSystem({
  radius,
  animate,
  phase,
  stage,
  index,
  count,
  onAssetError,
}: {
  radius: number;
  animate: boolean;
  /** Earth's own emphasis is derived here rather than read from a value the
   * rig writes: R3F runs a child's frame callback before its parent's, so
   * reading it would always be one frame stale. */
  phase: PhaseRef;
  /** On Posts the Earth is the whole scene, so its satellite is always worth
   * drawing regardless of where the home loop left the phase. */
  stage: StageRef;
  index: number;
  count: number;
  onAssetError: AssetErrorReporter;
}) {
  const earthSpin = useRef<Group>(null);
  const moonOrbit = useRef<Group>(null);
  const moonSpin = useRef<Group>(null);
  const satellite = useRef<Group>(null);

  useFrame((_, delta) => {
    // The Moon is the heaviest asset in the scene and is a couple of pixels
    // across once Earth recedes, so it stops being drawn rather than being
    // drawn invisibly small. Visibility is the only thing culled; the orbit
    // keeps its phase so returning to Earth never shows a jump.
    const visible =
      stage.current > 0.5 ||
      orbitNearness(index - phase.current, count) > SATELLITE_EMPHASIS;
    if (satellite.current) satellite.current.visible = visible;
    if (!animate) return;
    const step = Math.min(delta, MAX_FRAME_DELTA);
    if (earthSpin.current) earthSpin.current.rotation.y += step * SPIN_SPEED.earth;
    if (moonOrbit.current) moonOrbit.current.rotation.y += step * EARTH_SYSTEM.orbitSpeed;
    if (moonSpin.current) moonSpin.current.rotation.y += step * SPIN_SPEED.moon;
  });

  return (
    <group name="EarthSystem" scale={radius}>
      <group ref={earthSpin} name="EarthRotationRoot">
        <group scale={EARTH_SYSTEM.modelScale}>
          <PlanetAsset model={SCENE_MODELS.earth} onAssetError={onAssetError}>
            <EarthPlanetModel />
          </PlanetAsset>
        </group>
      </group>
      <group ref={satellite} name="MoonOrbitInclination" rotation-x={EARTH_SYSTEM.orbitInclination}>
        <group ref={moonOrbit} name="MoonOrbitRoot" rotation-y={EARTH_SYSTEM.orbitPhase}>
          <group name="MoonOffset" position-x={EARTH_SYSTEM.orbitRadius}>
            <group ref={moonSpin} name="MoonRotationRoot" scale={EARTH_SYSTEM.moonRadius}>
              <PlanetAsset model={SCENE_MODELS.moon} onAssetError={onAssetError}>
                <GenericPlanetModel modelConfig={SCENE_MODELS.moon} />
              </PlanetAsset>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
