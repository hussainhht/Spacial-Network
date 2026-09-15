"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, type DirectionalLight, type Group, type AmbientLight } from "three";
import { useGLTF } from "@react-three/drei";
import PlanetSystem from "./PlanetSystem";
import { SUN_POSITION } from "./earthMaterials";
import {
  type PlanetConfig,
  type PlanetViewport,
} from "./modelsRegistry";

// Cinematic Depth Transition Constants
const EXIT_DURATION = 0.40; // 400ms exit into deep space
const SWITCH_HOLD_DURATION = 0.06; // 60ms model swap hold
const ENTER_DURATION = 0.54; // 540ms entrance from deep space

const REDUCED_EXIT_DURATION = 0.12;
const REDUCED_ENTER_DURATION = 0.15;

const RECEDING_Z = -14.0; // Moves deep into the background on Z
const RECEDING_X = 0.75; // Subtle drift toward right edge matching scene composition
const RECEDING_SCALE = 0.035; // Shrinks to a tiny speck in deep space
const RECEDING_BANK_Y = 0.18; // Subtle yaw drift
const RECEDING_BANK_Z = -0.06; // Subtle roll tilt

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeOutCubic(t: number): number {
  const p = 1 - t;
  return 1 - p * p * p;
}

export type TransitionPhase = "idle" | "exiting" | "switching" | "entering";

interface PlanetTransitionProps {
  targetConfig: PlanetConfig;
  isTargetReady?: boolean;
  viewport: PlanetViewport;
  reducedMotion: boolean;
  onPhaseChange?: (phase: TransitionPhase) => void;
}

export default function PlanetTransition({
  targetConfig,
  isTargetReady = true,
  viewport,
  reducedMotion,
  onPhaseChange,
}: PlanetTransitionProps) {
  const { invalidate } = useThree();

  // Active planet currently rendered in PlanetSystem
  const [activeConfig, setActiveConfig] = useState<PlanetConfig>(targetConfig);

  // References for transform animation
  const transitionGroupRef = useRef<Group>(null);
  const ambientLightRef = useRef<AmbientLight>(null);
  const directionalLightRef = useRef<DirectionalLight>(null);

  // State machine refs
  const phaseRef = useRef<TransitionPhase>("idle");
  const progressRef = useRef(0);
  const switchTimerRef = useRef(0);
  const pendingTargetRef = useRef<PlanetConfig>(targetConfig);
  const isTargetReadyRef = useRef(isTargetReady);
  isTargetReadyRef.current = isTargetReady;

  // Track lights for smooth interpolation
  const currentAmbientRef = useRef(targetConfig.lighting.ambientIntensity);
  const currentDirectionalRef = useRef(targetConfig.lighting.directionalIntensity);

  const notifyPhase = useCallback(
    (phase: TransitionPhase) => {
      phaseRef.current = phase;
      onPhaseChange?.(phase);
    },
    [onPhaseChange],
  );

  // When targetConfig changes from outside
  useEffect(() => {
    pendingTargetRef.current = targetConfig;

    // Start preloading upcoming model immediately
    try {
      useGLTF.preload(targetConfig.modelPath);
    } catch {
      // Ignored if preloader fails or already cached
    }

    if (targetConfig.id === activeConfig.id) {
      if (phaseRef.current === "exiting") {
        // User re-selected current planet while exiting: reverse back to entering
        notifyPhase("entering");
        progressRef.current = Math.max(0, 1 - progressRef.current);
      }
      return;
    }

    // New target requested
    if (phaseRef.current === "idle") {
      notifyPhase("exiting");
      progressRef.current = 0;
      invalidate();
    } else if (phaseRef.current === "entering") {
      // User clicked while entering: smoothly reverse back into space toward new target
      notifyPhase("exiting");
      progressRef.current = Math.max(0, 1 - progressRef.current);
      invalidate();
    }
  }, [activeConfig.id, invalidate, notifyPhase, targetConfig]);

  useFrame((_, rawDelta) => {
    const group = transitionGroupRef.current;
    if (!group) return;

    // Cap delta to prevent animation jumping during frame drops
    const dt = Math.min(rawDelta, 0.05);
    const phase = phaseRef.current;

    if (phase === "idle") {
      // Check if a new target was queued
      if (pendingTargetRef.current.id !== activeConfig.id) {
        notifyPhase("exiting");
        progressRef.current = 0;
        invalidate();
      }
      return;
    }

    // Force frame invalidation so render loop stays active during transition
    invalidate();

    if (phase === "exiting") {
      const exitDur = reducedMotion ? REDUCED_EXIT_DURATION : EXIT_DURATION;
      progressRef.current = Math.min(1, progressRef.current + dt / exitDur);
      const p = progressRef.current;
      const e = easeInCubic(p);

      if (reducedMotion) {
        group.position.set(0, 0, 0);
        group.scale.setScalar(MathUtils.lerp(1, 0.94, e));
        group.rotation.set(0, 0, 0);
      } else {
        const z = MathUtils.lerp(0, RECEDING_Z, e);
        const x = MathUtils.lerp(0, RECEDING_X, e);
        const s = MathUtils.lerp(1, RECEDING_SCALE, e);
        const ry = MathUtils.lerp(0, RECEDING_BANK_Y, e);
        const rz = MathUtils.lerp(0, RECEDING_BANK_Z, e);

        group.position.set(x, 0, z);
        group.scale.setScalar(s);
        group.rotation.set(0, ry, rz);
      }

      if (p >= 1) {
        notifyPhase("switching");
        switchTimerRef.current = SWITCH_HOLD_DURATION;
      }
      return;
    }

    if (phase === "switching") {
      switchTimerRef.current -= dt;

      // Swap model once switch hold finishes AND model is ready
      if (switchTimerRef.current <= 0 && isTargetReadyRef.current) {
        const next = pendingTargetRef.current;
        setActiveConfig(next);
        notifyPhase("entering");
        progressRef.current = 0;
      }
      return;
    }

    if (phase === "entering") {
      const enterDur = reducedMotion ? REDUCED_ENTER_DURATION : ENTER_DURATION;
      progressRef.current = Math.min(1, progressRef.current + dt / enterDur);
      const p = progressRef.current;
      const e = easeOutCubic(p);

      if (reducedMotion) {
        group.position.set(0, 0, 0);
        group.scale.setScalar(MathUtils.lerp(0.94, 1, e));
        group.rotation.set(0, 0, 0);
      } else {
        const z = MathUtils.lerp(RECEDING_Z, 0, e);
        const x = MathUtils.lerp(RECEDING_X, 0, e);
        const s = MathUtils.lerp(RECEDING_SCALE, 1, e);
        const ry = MathUtils.lerp(RECEDING_BANK_Y, 0, e);
        const rz = MathUtils.lerp(RECEDING_BANK_Z, 0, e);

        group.position.set(x, 0, z);
        group.scale.setScalar(s);
        group.rotation.set(0, ry, rz);
      }

      // Smoothly interpolate lighting to target configuration
      if (ambientLightRef.current && directionalLightRef.current) {
        currentAmbientRef.current = MathUtils.lerp(
          currentAmbientRef.current,
          activeConfig.lighting.ambientIntensity,
          e,
        );
        currentDirectionalRef.current = MathUtils.lerp(
          currentDirectionalRef.current,
          activeConfig.lighting.directionalIntensity,
          e,
        );
        ambientLightRef.current.intensity = currentAmbientRef.current;
        directionalLightRef.current.intensity = currentDirectionalRef.current;
      }

      if (p >= 1) {
        group.position.set(0, 0, 0);
        group.scale.setScalar(1);
        group.rotation.set(0, 0, 0);
        notifyPhase("idle");

        // If another target was queued while entering, trigger exit immediately
        if (pendingTargetRef.current.id !== activeConfig.id) {
          notifyPhase("exiting");
          progressRef.current = 0;
        }
      }
    }
  });

  return (
    <>
      <ambientLight
        ref={ambientLightRef}
        intensity={activeConfig.lighting.ambientIntensity}
      />
      <directionalLight
        ref={directionalLightRef}
        position={SUN_POSITION}
        intensity={activeConfig.lighting.directionalIntensity}
      />
      <group ref={transitionGroupRef}>
        <Suspense fallback={null}>
          <PlanetSystem
            key={activeConfig.id}
            config={activeConfig}
            viewport={viewport}
            reducedMotion={reducedMotion}
            isInitialEntrance={false}
          />
        </Suspense>
      </group>
    </>
  );
}
