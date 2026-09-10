"use client";

import { useCallback, useMemo } from "react";
import type {
  HomeMotionController,
  HomeMotionOptions,
  PlanetId,
} from "../contracts";
import { usePlanetGestures } from "./usePlanetGestures";
import { usePlanetLoop } from "./usePlanetLoop";

/**
 * Composes the homepage's motion: gestures produce intent, the loop turns
 * intent into one timeline at a time.
 *
 * There is no ScrollTrigger, no pin and no artificial page height here. The
 * previous implementation pinned a spacer worth roughly two viewports of
 * scroll, scrubbed a playhead 0.8s behind the wheel and then snapped the
 * scroll position back on top of that — three systems all writing the same
 * position, which is what made scrolling feel heavy and stuck.
 */
export function useUniverseHomeMotion(
  options: HomeMotionOptions,
): HomeMotionController {
  const { root, phase, scene, reducedMotion, enabled, onCommit } = options;

  const loop = usePlanetLoop({
    phase,
    reducedMotion,
    invalidate: scene?.invalidate ?? null,
    onCommit,
  });

  const ready = enabled && scene !== null;

  const step = useCallback(
    (direction: 1 | -1) => {
      if (!ready) return;
      loop.step(direction);
    },
    [ready, loop],
  );

  const goToPlanet = useCallback(
    (id: PlanetId) => {
      if (!ready) return;
      loop.goToPlanet(id);
    },
    [ready, loop],
  );

  usePlanetGestures({ surface: root, enabled: ready, onStep: step });

  return useMemo(
    () => ({ pause: loop.pause, resume: loop.resume, goToPlanet, step }),
    [loop.pause, loop.resume, goToPlanet, step],
  );
}
