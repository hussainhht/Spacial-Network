"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import type {
  PhaseRef,
  StageRef,
  StageTargetRef,
  UniverseSceneHandle,
  UniverseStageId,
} from "@/features/universe-home/contracts";
import {
  PLANET_ORDER,
  stagePlanet,
} from "@/features/universe-home/navigation/planetDestinations";
import {
  planetIndex,
  shortestStep,
  wrapIndex,
} from "@/features/universe-home/navigation/planetLoop";

/**
 * Owns the blend between the home loop composition and a destination
 * composition, and the single tween pair allowed to move it.
 *
 * Both values are plain numbers in cells the scene reads inside `useFrame`, so
 * a route change costs no renders and GSAP never writes a transform the frame
 * loop is also writing — which is what lets the Earth keep spinning, the Moon
 * keep orbiting and Mars keep turning all the way through a transition.
 *
 * The loop phase travels with the blend for one reason: a destination belongs
 * to one planet, so leaving Posts must return to Earth and leaving Groups to
 * Mars, rather than to whichever planet happened to be in focus when the reader
 * left Home.
 *
 * `stageTarget` names which composition the blend leads to. It is written only
 * on the way out (`to > 0`) and deliberately left alone on the way back, so a
 * return is an interpolation of the same two compositions the departure was —
 * the bodies retrace the spiral they arrived on instead of snapping to a
 * different destination's geometry half way home.
 */
export function useStageTravel({
  stageRef,
  stageTargetRef,
  phaseRef,
  scene,
}: {
  stageRef: StageRef;
  stageTargetRef: StageTargetRef;
  phaseRef: PhaseRef;
  scene: UniverseSceneHandle | null;
}) {
  const stageTween = useRef<gsap.core.Tween | null>(null);
  const phaseTween = useRef<gsap.core.Tween | null>(null);
  // The scene handle changes identity when the Canvas remounts, and a tween
  // outlives the render that started it.
  const latest = useRef(scene);
  useLayoutEffect(() => {
    latest.current = scene;
  }, [scene]);

  const stop = useCallback(() => {
    stageTween.current?.kill();
    phaseTween.current?.kill();
    stageTween.current = null;
    phaseTween.current = null;
  }, []);

  const travel = useCallback(
    (to: number, duration: number, target?: UniverseStageId) => {
      stop();
      // Only needed while the renderer is on demand (reduced motion); with a
      // live frameloop this is a no-op that costs one function call a frame.
      const wake = () => latest.current?.invalidate();
      // Changing destination mid-move would reinterpret the blend the scene is
      // already part way through, so only a departure may set it.
      if (to > 0 && target) stageTargetRef.current = target;
      const count = PLANET_ORDER.length;
      const from = Math.round(phaseRef.current);
      const phaseTarget =
        to > 0
          ? from +
            shortestStep(
              wrapIndex(from, count),
              planetIndex(stagePlanet(stageTargetRef.current)),
              count,
            )
          : phaseRef.current;

      if (duration <= 0) {
        stageRef.current = to;
        phaseRef.current = phaseTarget;
        wake();
        return;
      }
      phaseTween.current = gsap.to(phaseRef, {
        current: phaseTarget,
        duration,
        ease: "power2.inOut",
        overwrite: true,
        onComplete: () => {
          phaseTween.current = null;
        },
      });
      stageTween.current = gsap.to(stageRef, {
        current: to,
        duration,
        ease: "power2.inOut",
        overwrite: true,
        onUpdate: wake,
        onComplete: () => {
          stageTween.current = null;
          wake();
        },
      });
    },
    [stageRef, stageTargetRef, phaseRef, stop],
  );

  useLayoutEffect(() => stop, [stop]);

  return { travel, stop };
}
