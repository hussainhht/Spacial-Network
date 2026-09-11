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
  StageTargetRef,
} from "../contracts";
import {
  createPlacement,
  orbitNearness,
  placeOnOrbit,
  spiralToPoint,
} from "../motion/orbitPath";
import { stagePlanet } from "../navigation/planetDestinations";
import EarthSystem from "./EarthSystem";
import PlanetAsset, { type AssetErrorReporter } from "./PlanetAsset";
import {
  ABSORB_DELAY,
  ABSORB_SWEEP,
  IDLE_DRIFT,
  IDLE_DRIFT_SPEED,
  MAX_FRAME_DELTA,
  NEIGHBOUR_RECEDE,
  SCENE_MODELS,
  SPIN_SPEED,
  type SceneFraming,
} from "./sceneConfig";

const mix = (from: number, to: number, t: number) => from + (to - from) * t;
/** A body holds its orbit placement until its own delay has elapsed, then
 * covers the rest of the blend — so a staggered start still lands on time. */
const staggered = (blend: number, delay: number) =>
  delay >= 1 ? blend : Math.max(0, (blend - delay) / (1 - delay));

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
 * destination placement from it — Posts or Groups, whichever `stageTarget`
 * names. GSAP never touches a transform the frame loop also writes, so the two
 * can run at once without fighting, which is what lets Earth keep spinning, the
 * Moon keep orbiting and Mars keep turning all the way through a move.
 */
export default function PlanetRig({
  rig,
  index,
  count,
  phase,
  stage,
  stageTarget,
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
  stageTarget: StageTargetRef;
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
    // Exactly one planet is the subject of the composition being travelled to;
    // every other body leaves. Which planet that is comes from the destination
    // table, so a new stage never means a new branch here.
    const subject = stagePlanet(stageTarget.current);
    if (body.current) body.current.visible = blend < 1 || id === subject;
    if (blend === 0) {
      rig.orbitRoot.position.set(placement.x, y, placement.z);
      rig.orbitRoot.scale.setScalar(placement.scale);
    } else if (id === subject) {
      // The subject travels rather than fades: it is the same object on both
      // pages, so it has to arrive where the destination's anchor says.
      const target =
        stageTarget.current === "posts" ? framing.posts : framing.groups.mars;
      rig.orbitRoot.position.set(
        mix(placement.x, target.x, blend),
        mix(y, target.y, blend),
        mix(placement.z, target.z, blend),
      );
      rig.orbitRoot.scale.setScalar(mix(placement.scale, target.scale, blend));
    } else if (stageTarget.current === "groups") {
      // Groups has a core star at its centre, so the bodies leaving do not
      // simply withdraw — they spiral into it and are absorbed, each starting a
      // beat after the one before.
      const t = staggered(blend, ABSORB_DELAY[id]);
      spiralToPoint(
        placement,
        drift,
        framing.groups.star,
        t,
        ABSORB_SWEEP,
        placement,
      );
      rig.orbitRoot.position.set(placement.x, placement.y, placement.z);
      rig.orbitRoot.scale.setScalar(placement.scale);
      if (body.current && t >= 1) body.current.visible = false;
    } else {
      // Posts has nothing at its centre to be absorbed by, so the neighbours
      // withdraw along their own depth axis instead — which reads as leaving
      // rather than as a fade — and stop being drawn once they are gone.
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
              stageTarget={stageTarget}
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
