"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { EarthPlanetModel, GenericPlanetModel } from "@/components/space/DevPlanetModel";
import PlanetAsset, { type AssetErrorReporter } from "./PlanetAsset";
import { EARTH_SYSTEM, MAX_FRAME_DELTA, SCENE_MODELS, SPIN_SPEED } from "./sceneConfig";

export default function EarthSystem({
  radius,
  animate,
  onAssetError,
}: {
  radius: number;
  animate: boolean;
  onAssetError: AssetErrorReporter;
}) {
  const earthSpin = useRef<Group>(null);
  const moonOrbit = useRef<Group>(null);
  const moonSpin = useRef<Group>(null);

  useFrame((_, delta) => {
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
      <group name="MoonOrbitInclination" rotation-x={EARTH_SYSTEM.orbitInclination}>
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
