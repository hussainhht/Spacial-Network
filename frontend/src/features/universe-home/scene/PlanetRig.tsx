"use client";

import { useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { GenericPlanetModel } from "@/components/space/DevPlanetModel";
import type {
  PhaseRef,
  PlanetId,
  PlanetRigHandle,
  StageRef,
} from "../contracts";
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
  NEIGHBOUR_RECEDE,
  SCENE_MODELS,
  SPIN_SPEED,
  type SceneFraming,
} from "./sceneConfig";

const mix = (from: number, to: number, t: number) => from + (to - from) * t;

export function createPlanetRigs(
  order: readonly PlanetId[],
): ReadonlyMap<PlanetId, PlanetRigHandle> {
  return new Map(
    order.map((id) => {
      const transitionRoot = new Group();
      const orbitRoot = new Group();
      transitionRoot.name = `${id}-TransitionRoot`;
      orbitRoot.name = `${id}-OrbitRoot`;
      return [id, { id, transitionRoot, orbitRoot }];
    }),
  );
}

/**
 * One destination on the loop.
 *
 * Exactly one frame callback writes `orbitRoot.position`/`scale`, from the
 * shared phase; a separate child group carries the idle spin. Because the two
 * live on different objects they can never fight for the same value, and a
 * transition never has to stop the rotation to take over.
 *
 * A route transition is the same story one level up: GSAP owns `stage`, a plain
 * number, and this callback interpolates between the loop placement and the
 * Posts placement from it. GSAP never touches a transform the frame loop also
 * writes, so the two can run at once without fighting — which is what lets the
 * Earth keep spinning and the Moon keep orbiting all the way through the move.
 */
export default function PlanetRig({
  rig,
  index,
  count,
  phase,
  stage,
  framing,
  animate,
  onAssetError,
  onActivate,
}: {
  rig: PlanetRigHandle;
  index: number;
  count: number;
  phase: PhaseRef;
  stage: StageRef;
  framing: SceneFraming;
  animate: boolean;
  onAssetError: AssetErrorReporter;
  onActivate: (id: PlanetId) => void;
}) {
  const spin = useRef<Group>(null);
  // Visibility lives on a local group rather than on the published orbitRoot.
  // The rig's roots have exactly one documented writer each, and hiding the
  // body here also lifts its hit proxy out of the raycast — a neighbour that
  // has left the scene must not still be clickable.
  const body = useRef<Group>(null);
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

    const y = placement.y + drift;
    const blend = stage.current <= 0 ? 0 : Math.min(1, stage.current);
    if (body.current) body.current.visible = blend < 1 || id === "earth";
    if (blend === 0) {
      rig.orbitRoot.position.set(placement.x, y, placement.z);
      rig.orbitRoot.scale.setScalar(placement.scale);
    } else if (id === "earth") {
      // Earth is the subject on both pages, so it travels rather than fades.
      const target = framing.posts;
      rig.orbitRoot.position.set(
        mix(placement.x, target.x, blend),
        mix(y, target.y, blend),
        mix(placement.z, target.z, blend),
      );
      rig.orbitRoot.scale.setScalar(mix(placement.scale, target.scale, blend));
    } else {
      // The neighbours are not part of the Posts composition. They withdraw
      // along their own depth axis, which reads as leaving rather than as a
      // fade — and stop being drawn entirely once they are gone.
      rig.orbitRoot.position.set(
        placement.x,
        y,
        placement.z - blend * NEIGHBOUR_RECEDE,
      );
      rig.orbitRoot.scale.setScalar(placement.scale * (1 - blend));
    }
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
        <group ref={body} name={`${id}-Body`}>
          {id === "earth" ? (
            <EarthSystem
              radius={framing.earthRadius}
              animate={animate}
              phase={phase}
              stage={stage}
              index={index}
              count={count}
              onAssetError={onAssetError}
            />
          ) : (
            <group
              name={`${id}-Framing`}
              scale={id === "mars" ? framing.marsScale : framing.saturnScale}
            >
              <group ref={spin} name={`${id}-RotationRoot`}>
                <PlanetAsset
                  model={SCENE_MODELS[id]}
                  onAssetError={onAssetError}
                >
                  <GenericPlanetModel modelConfig={SCENE_MODELS[id]} />
                </PlanetAsset>
              </group>
            </group>
          )}
          <mesh visible={false} onClick={activate}>
            <sphereGeometry args={[hitRadius, 12, 8]} />
          </mesh>
        </group>
      </primitive>
    </primitive>
  );
}
