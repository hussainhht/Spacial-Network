"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import { Group, MathUtils } from "three";

type Vector3Tuple = [number, number, number];

const MAX_FRAME_DELTA = 0.1;
const FULL_ROTATION = Math.PI * 2;

function boundedDelta(delta: number) {
  return Math.min(delta, MAX_FRAME_DELTA);
}

function easeOutQuart(progress: number) {
  return 1 - Math.pow(1 - progress, 4);
}

interface PlanetEntranceProps {
  children: ReactNode;
  reducedMotion: boolean;
  duration?: number;
  fromPosition?: Vector3Tuple;
  fromScale?: number;
}

/**
 * Owns only the one-time reveal transform. Mount this component with a new key
 * when a future planet change needs to replay the same entrance choreography.
 */
export function PlanetEntrance({
  children,
  reducedMotion,
  duration = 1.8,
  fromPosition = [0, -0.04, -3.2],
  fromScale = 0.28,
}: PlanetEntranceProps) {
  const root = useRef<Group>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    const group = root.current;
    if (!group || reducedMotion || elapsed.current >= duration) return;

    elapsed.current = Math.min(elapsed.current + boundedDelta(delta), duration);
    const progress = elapsed.current / duration;
    const easedProgress = easeOutQuart(progress);

    group.position.set(
      MathUtils.lerp(fromPosition[0], 0, easedProgress),
      MathUtils.lerp(fromPosition[1], 0, easedProgress),
      MathUtils.lerp(fromPosition[2], 0, easedProgress),
    );
    group.scale.setScalar(MathUtils.lerp(fromScale, 1, easedProgress));
  });

  return (
    <group
      ref={root}
      position={reducedMotion ? [0, 0, 0] : fromPosition}
      scale={reducedMotion ? 1 : fromScale}
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
}

/** Owns a body's intrinsic Y-axis rotation without touching system transforms. */
export function AxialRotation({
  children,
  reducedMotion,
  radiansPerSecond,
  initialRotation = 0,
}: AxialRotationProps) {
  const root = useRef<Group>(null);

  useFrame((_, delta) => {
    const group = root.current;
    if (!group || reducedMotion) return;

    group.rotation.y =
      (group.rotation.y + boundedDelta(delta) * radiansPerSecond) %
      FULL_ROTATION;
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
