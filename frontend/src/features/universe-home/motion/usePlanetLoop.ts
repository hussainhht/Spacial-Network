"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import type { PhaseRef, PlanetId } from "../contracts";
import { PLANET_ORDER } from "../navigation/planetDestinations";
import {
  planetIdAtPhase,
  planetIndex,
  shortestStep,
  wrapIndex,
  wrapPhase,
} from "../navigation/planetLoop";

/** Explicit states, not a handful of related booleans. Anything other than
 * "idle" means a timeline owns the phase and nothing else may write it. */
export type LoopState = "idle" | "moving-forward" | "moving-backward";

const COUNT = PLANET_ORDER.length;
/** Long enough to read as deliberate travel, short enough that a second scroll
 * never feels blocked. Multi-step moves get a little more, not proportionally
 * more, so crossing the whole loop stays under a second and a half. */
const STEP_DURATION = 1.05;
const EXTRA_PER_STEP = 0.28;
const REDUCED_DURATION = 0.24;

export type PlanetLoop = {
  step: (direction: 1 | -1) => void;
  goToPlanet: (id: PlanetId) => void;
  pause: () => void;
  resume: () => void;
};

/**
 * Owns the loop's continuous phase and the single timeline allowed to move it.
 *
 * The phase is a plain number in a ref. GSAP tweens that number; the scene
 * reads it inside `useFrame`. No React state changes while a move is running —
 * `onCommit` fires once, at the end, when the new destination becomes official.
 */
export function usePlanetLoop({
  phase,
  reducedMotion,
  invalidate,
  onCommit,
}: {
  phase: PhaseRef;
  reducedMotion: boolean;
  invalidate: (() => void) | null;
  onCommit: (id: PlanetId) => void;
}): PlanetLoop {
  const stateRef = useRef<LoopState>("idle");
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  /** The phase the running move is heading for; an integer. */
  const targetRef = useRef(Math.round(phase.current));
  /** At most one pending move. A newer request replaces it rather than adding
   * to it, so holding a gesture down cannot build an unbounded backlog. */
  const queuedRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  // Read through a ref rather than closing over them: the tween outlives the
  // render that started it, and re-creating callbacks would re-create it too.
  const latest = useRef({ reducedMotion, invalidate, onCommit });
  useLayoutEffect(() => {
    latest.current = { reducedMotion, invalidate, onCommit };
  }, [reducedMotion, invalidate, onCommit]);

  const runRef = useRef<(target: number) => void>(() => {});

  const run = useCallback((target: number) => {
    const { reducedMotion: reduced, invalidate: wake, onCommit: commit } =
      latest.current;
    const from = phase.current;
    const distance = Math.abs(target - from);
    if (distance < 1e-4) {
      stateRef.current = "idle";
      return;
    }

    stateRef.current = target > from ? "moving-forward" : "moving-backward";
    targetRef.current = target;

    const steps = Math.max(1, Math.round(distance));
    const duration = reduced
      ? REDUCED_DURATION
      : STEP_DURATION + EXTRA_PER_STEP * (steps - 1);

    tweenRef.current?.kill();
    tweenRef.current = gsap.to(phase, {
      current: target,
      duration,
      // Settles without the elastic overshoot that reads as a wobble on a
      // body this large, and spends most of its time at speed rather than
      // creeping at the ends.
      ease: reduced ? "power2.out" : "power3.inOut",
      overwrite: true,
      // Only needed while the renderer is on demand (reduced motion); with a
      // live frameloop this is a no-op that costs one function call a frame.
      onUpdate: wake ?? undefined,
      onComplete: () => {
        tweenRef.current = null;
        // Renormalise. The orbit path is periodic in COUNT, so folding the
        // phase back into [0, COUNT) produces the identical transform for
        // every planet: the loop can run forever with no drift and no jump.
        const settled = wrapPhase(target, COUNT);
        phase.current = settled;
        targetRef.current = settled;
        stateRef.current = "idle";
        wake?.();
        commit(planetIdAtPhase(settled));

        const queued = queuedRef.current;
        queuedRef.current = null;
        if (queued !== null && !pausedRef.current) {
          runRef.current(settled + (queued > 0 ? 1 : -1));
        }
      },
    });
  }, [phase]);

  useLayoutEffect(() => {
    runRef.current = run;
  }, [run]);

  const request = useCallback(
    (target: number) => {
      if (pausedRef.current) return;
      if (stateRef.current !== "idle") {
        // Record the direction only. Storing the absolute target would let a
        // held gesture queue five planets deep; one step past the move already
        // in flight is the whole allowance.
        queuedRef.current = target > targetRef.current ? 1 : -1;
        return;
      }
      run(target);
    },
    [run],
  );

  const step = useCallback(
    (direction: 1 | -1) => {
      request(targetRef.current + direction);
    },
    [request],
  );

  const goToPlanet = useCallback(
    (id: PlanetId) => {
      const steps = shortestStep(
        wrapIndex(targetRef.current, COUNT),
        planetIndex(id),
        COUNT,
      );
      if (steps === 0) return;
      request(targetRef.current + steps);
    },
    [request],
  );

  const pause = useCallback(() => {
    pausedRef.current = true;
    queuedRef.current = null;
    tweenRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    tweenRef.current?.resume();
  }, []);

  useEffect(
    () => () => {
      tweenRef.current?.kill();
      tweenRef.current = null;
      queuedRef.current = null;
      stateRef.current = "idle";
    },
    [],
  );

  return useMemo(
    () => ({ step, goToPlanet, pause, resume }),
    [step, goToPlanet, pause, resume],
  );
}
