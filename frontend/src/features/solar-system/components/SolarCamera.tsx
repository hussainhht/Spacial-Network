"use client";

import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import {
  Vector3,
  type PerspectiveCamera as ThreePerspectiveCamera,
} from "three";
import {
  FAR_PLANE,
  NEAR_PLANE,
  type SolarFraming,
} from "../config/composition";

/** Reused rather than allocated: this runs on every resize, and a resize fires
 * many times a second while a window is being dragged. */
const LOOK_AT = new Vector3();

/**
 * The fixed cinematic camera.
 *
 * It is set once per measured viewport and then left alone — nothing animates
 * it, and nothing else in the scene writes to it. Keeping the viewpoint still is
 * what lets the composition be authored at all: every planet's screen position
 * and depth layer in `planets.ts` is only meaningful because this is where the
 * scene is seen from. Travelling it is the next phase's work, and this is the
 * one component it will need to take over.
 */
export default function SolarCamera({ framing }: { framing: SolarFraming }) {
  const camera = useRef<ThreePerspectiveCamera>(null);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);

  // Aim, rather than orientation props: the target is a point on the orbital
  // plane, and deriving Euler angles for it by hand would be a second way of
  // saying the same thing.
  useLayoutEffect(() => {
    if (!camera.current) return;
    camera.current.lookAt(LOOK_AT.set(...framing.target));
    camera.current.updateProjectionMatrix();
    // A reduced-motion scene renders on demand, so a re-frame has to ask for
    // the frame that shows it.
    invalidate();
  }, [framing, size.width, size.height, invalidate]);

  return (
    <PerspectiveCamera
      ref={camera}
      makeDefault
      fov={framing.fov}
      near={NEAR_PLANE}
      far={FAR_PLANE}
      position={framing.position}
    />
  );
}
