"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { Group, MathUtils } from "three";

const MAX_FRAME_DELTA = 0.1;
const FULL_ROTATION = Math.PI * 2;

function boundedDelta(delta: number) {
  return Math.min(delta, MAX_FRAME_DELTA);
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

interface PlanetEntranceProps {
  children: ReactNode;
  reducedMotion: boolean;
  duration?: number;
  offscreenRadius?: number;
  edgePadding?: number;
}

/**
 * Owns only the one-time reveal transform. Mount this component with a new key
 * when a future planet change needs to replay the same entrance choreography.
 */
export function PlanetEntrance({
  children,
  reducedMotion,
  duration = 2.1,
  offscreenRadius = 1,
  edgePadding = 0.16,
}: PlanetEntranceProps) {
  const root = useRef<Group>(null);
  const elapsed = useRef(0);
  const viewportWidth = useThree((state) => state.viewport.width);
  const [startX] = useState(
    () => viewportWidth / 2 + offscreenRadius + edgePadding,
  );

  useFrame((_, delta) => {
    const group = root.current;
    if (!group || reducedMotion || elapsed.current >= duration) return;

    elapsed.current = Math.min(elapsed.current + boundedDelta(delta), duration);
    const progress = elapsed.current / duration;
    const easedProgress = easeOutCubic(progress);

    group.position.x = MathUtils.lerp(startX, 0, easedProgress);

    if (elapsed.current === duration) {
      group.position.x = 0;
    }
  });

  return (
    <group
      ref={root}
      position={reducedMotion ? [0, 0, 0] : [startX, 0, 0]}
    >
      {children}
    </group>
  );
}

interface PlanetIdleMotionProps {
  children: ReactNode;
  reducedMotion: boolean;
  amplitude?: number;
  cyclesPerSecond?: number;
}

/** A transform-isolated, optional resting drift for any planet system. */
export function PlanetIdleMotion({
  children,
  reducedMotion,
  amplitude = 0.012,
  cyclesPerSecond = 0.055,
}: PlanetIdleMotionProps) {
  const root = useRef<Group>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    const group = root.current;
    if (!group || reducedMotion) return;

    elapsed.current += boundedDelta(delta);
    group.position.y =
      Math.sin(elapsed.current * cyclesPerSecond * FULL_ROTATION) * amplitude;
  });

  return <group ref={root}>{children}</group>;
}

interface AxialRotationProps {
  children: ReactNode;
  reducedMotion: boolean;
  radiansPerSecond: number;
  initialRotation?: number;
  scrollRotation?: RefObject<number>;
}

/** Owns a body's intrinsic Y-axis rotation without touching system transforms. */
export function AxialRotation({
  children,
  reducedMotion,
  radiansPerSecond,
  initialRotation = 0,
  scrollRotation,
}: AxialRotationProps) {
  const root = useRef<Group>(null);
  const intrinsicRotation = useRef(initialRotation);

  useFrame((_, delta) => {
    const group = root.current;
    if (!group || reducedMotion) return;

    intrinsicRotation.current =
      (intrinsicRotation.current + boundedDelta(delta) * radiansPerSecond) %
      FULL_ROTATION;
    group.rotation.y =
      intrinsicRotation.current + (scrollRotation?.current ?? 0);
  });

  return (
    <group ref={root} rotation={[0, initialRotation, 0]}>
      {children}
    </group>
  );
}

interface OrbitingCompanionProps {
  children: ReactNode;
  reducedMotion: boolean;
  radius: number;
  radiansPerSecond: number;
  initialPhase?: number;
  inclination?: number;
  planeRotation?: number;
}

/**
 * Keeps the orbital pivot separate from both the primary body's spin and the
 * companion's local transform. Children inherit a natural tidally locked turn.
 */
export function OrbitingCompanion({
  children,
  reducedMotion,
  radius,
  radiansPerSecond,
  initialPhase = 0,
  inclination = 0,
  planeRotation = 0,
}: OrbitingCompanionProps) {
  const orbitRoot = useRef<Group>(null);

  useFrame((_, delta) => {
    const group = orbitRoot.current;
    if (!group || reducedMotion) return;

    group.rotation.y =
      (group.rotation.y + boundedDelta(delta) * radiansPerSecond) %
      FULL_ROTATION;
  });

  return (
    <group rotation={[inclination, 0, planeRotation]}>
      <group ref={orbitRoot} rotation={[0, initialPhase, 0]}>
        <group position={[radius, 0, 0]}>{children}</group>
      </group>
    </group>
  );
}
