"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import type {
  Object3D,
  PerspectiveCamera as ThreePerspectiveCamera,
} from "three";
import {
  FAR_PLANE,
  NEAR_PLANE,
  type SolarFraming,
} from "../config/composition";
import type { PlanetId } from "../config/planets";
import {
  applyPose,
  evaluateRig,
  type CameraRig,
  type PoseContext,
} from "../navigation/cameraPose";

/**
 * The only writer of the camera.
 *
 * It holds no animation of its own. Each frame it asks the rig where the camera
 * should be — the Home framing, a body destination resolved against that body's
 * live position, or a blend between two of them part way through a move — and
 * puts it there. GSAP drives the rig's progress from outside the canvas; the
 * bodies keep orbiting and spinning in their own frame callbacks; nothing else
 * touches the camera, so nothing can fight it. There are no OrbitControls in
 * this scene for the same reason.
 *
 * Rendered after the bodies, so its frame callback runs after theirs and reads
 * each body where it is being drawn this frame rather than where it was last
 * frame.
 */
export default function UniverseCameraController({
  framing,
  rigRef,
  bodiesRef,
}: {
  framing: SolarFraming;
  rigRef: RefObject<CameraRig>;
  bodiesRef: RefObject<Map<PlanetId, Object3D>>;
}) {
  const camera = useRef<ThreePerspectiveCamera>(null);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const context = useRef<PoseContext | null>(null);

  useLayoutEffect(() => {
    context.current = {
      framing,
      aspect: size.width / Math.max(1, size.height),
      bodies: bodiesRef.current,
    };
    // A reduced-motion scene renders on demand, so a re-frame has to ask for
    // the frame that shows it.
    invalidate();
  }, [framing, size.width, size.height, bodiesRef, invalidate]);

  // Lets the timeline, which lives outside the canvas, wake an on-demand
  // renderer.
  useLayoutEffect(() => {
    const rig = rigRef.current;
    rig.invalidate = invalidate;
    return () => {
      if (rig.invalidate === invalidate) rig.invalidate = () => {};
    };
  }, [rigRef, invalidate]);

  useFrame(() => {
    if (!camera.current || !context.current) return;
    const rig = rigRef.current;
    applyPose(camera.current, evaluateRig(rig, context.current, rig.current));
  });

  return (
    <PerspectiveCamera
      ref={camera}
      makeDefault
      near={NEAR_PLANE}
      far={FAR_PLANE}
    />
  );
}
