"use client";

import { useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { GenericPlanetModel } from "@/components/space/DevPlanetModel";
import type { PhaseRef, PlanetId, PlanetRigHandle } from "../contracts";
import {
  createPlacement,
  orbitNearness,
  placeOnOrbit,
} from "../motion/orbitPath";
import EarthSystem from "./EarthSystem";
import PlanetAsset, { type AssetErrorReporter } from "./PlanetAsset";
import {
  IDLE_DRIFT,
  IDLE_DRIFT_SPEED,
  MAX_FRAME_DELTA,
  SCENE_MODELS,
  SPIN_SPEED,
  type SceneFraming,
} from "./sceneConfig";

export function createPlanetRigs(order: readonly PlanetId[]): ReadonlyMap<PlanetId, PlanetRigHandle> {
  return new Map(order.map((id) => {
    const transitionRoot = new Group();
    const orbitRoot = new Group();
    transitionRoot.name = `${id}-TransitionRoot`;
    orbitRoot.name = `${id}-OrbitRoot`;
    return [id, { id, transitionRoot, orbitRoot }];
  }));
}

/**
 * One destination on the loop.
 *
 * Exactly one frame callback writes `orbitRoot.position`/`scale`, from the
 * shared phase; a separate child group carries the idle spin. Because the two
 * live on different objects they can never fight for the same value, and a
 * transition never has to stop the rotation to take over.
 */
export default function PlanetRig({
  rig,
  index,
  count,
  phase,
  framing,
  animate,
  onAssetError,
  onActivate,
}: {
  rig: PlanetRigHandle;
  index: number;
  count: number;
  phase: PhaseRef;
  framing: SceneFraming;
  animate: boolean;
  onAssetError: AssetErrorReporter;
  onActivate: (id: PlanetId) => void;
}) {
  const spin = useRef<Group>(null);
  const { id } = rig;
  const placement = useMemo(() => createPlacement(), []);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    const step = Math.min(delta, MAX_FRAME_DELTA);
    const offset = index - phase.current;
    const near = orbitNearness(offset, count);
    placeOnOrbit(offset, count, framing.orbit, placement);

    if (animate) {
      elapsed.current += step;
      if (spin.current) spin.current.rotation.y += step * SPIN_SPEED[id];
    }
    // A neighbour breathes very slightly; the subject holds still so nothing
    // competes with the body the reader is looking at.
    const drift = animate
      ? Math.sin(elapsed.current * IDLE_DRIFT_SPEED + index * 2.1) *
        IDLE_DRIFT *
        framing.halfHeight *
        (1 - near)
      : 0;

    rig.orbitRoot.position.set(placement.x, placement.y + drift, placement.z);
    rig.orbitRoot.scale.setScalar(placement.scale);
  });

  const activate = useCallback(() => onActivate(id), [onActivate, id]);

  // Hit proxy. R3F only raycasts objects that carry handlers, so the planets'
  // own meshes — 180k triangles apiece for Mars and the Moon — are never tested
  // against the pointer. The sphere matches each model's normalized radius.
  const hitRadius =
    id === "earth"
      ? framing.earthRadius
      : id === "mars"
        ? framing.marsScale
        : framing.saturnScale;

  return (
    <primitive object={rig.transitionRoot}>
      {/* This rig's frame callback exclusively owns orbitRoot's transform. */}
      <primitive object={rig.orbitRoot}>
        {id === "earth" ? (
          <EarthSystem
            radius={framing.earthRadius}
            animate={animate}
            phase={phase}
            index={index}
            count={count}
            onAssetError={onAssetError}
          />
        ) : (
          <group name={`${id}-Framing`} scale={id === "mars" ? framing.marsScale : framing.saturnScale}>
            <group ref={spin} name={`${id}-RotationRoot`}>
              <PlanetAsset model={SCENE_MODELS[id]} onAssetError={onAssetError}>
                <GenericPlanetModel modelConfig={SCENE_MODELS[id]} />
              </PlanetAsset>
            </group>
          </group>
        )}
        <mesh visible={false} onClick={activate}>
          <sphereGeometry args={[hitRadius, 12, 8]} />
        </mesh>
      </primitive>
    </primitive>
  );
}
