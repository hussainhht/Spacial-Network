"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { GenericPlanetModel } from "@/components/space/DevPlanetModel";
import type { PlanetId, PlanetRigHandle } from "../contracts";
import EarthSystem from "./EarthSystem";
import PlanetAsset, { type AssetErrorReporter } from "./PlanetAsset";
import { MAX_FRAME_DELTA, SCENE_MODELS, SPIN_SPEED, type SceneFraming } from "./sceneConfig";

export function createPlanetRigs(order: readonly PlanetId[]): ReadonlyMap<PlanetId, PlanetRigHandle> {
  return new Map(order.map((id) => {
    const transitionRoot = new Group();
    const scrollRoot = new Group();
    transitionRoot.name = `${id}-TransitionRoot`;
    scrollRoot.name = `${id}-ScrollRoot`;
    return [id, { id, transitionRoot, scrollRoot }];
  }));
}

export default function PlanetRig({
  rig,
  framing,
  animate,
  onAssetError,
}: {
  rig: PlanetRigHandle;
  framing: SceneFraming;
  animate: boolean;
  onAssetError: AssetErrorReporter;
}) {
  const spin = useRef<Group>(null);
  const { id } = rig;
  useFrame((_, delta) => {
    if (animate && spin.current) {
      spin.current.rotation.y += Math.min(delta, MAX_FRAME_DELTA) * SPIN_SPEED[id];
    }
  });

  return (
    <primitive object={rig.transitionRoot}>
      {/* Agent 2 exclusively controls scrollRoot.position.x, including mount. */}
      <primitive object={rig.scrollRoot}>
        {id === "earth" ? (
          <EarthSystem radius={framing.earthRadius} animate={animate} onAssetError={onAssetError} />
        ) : (
          <group name={`${id}-Framing`} scale={id === "mars" ? framing.marsScale : framing.saturnScale}>
            <group ref={spin} name={`${id}-RotationRoot`}>
              <PlanetAsset model={SCENE_MODELS[id]} onAssetError={onAssetError}>
                <GenericPlanetModel modelConfig={SCENE_MODELS[id]} />
              </PlanetAsset>
            </group>
          </group>
        )}
      </primitive>
    </primitive>
  );
}
