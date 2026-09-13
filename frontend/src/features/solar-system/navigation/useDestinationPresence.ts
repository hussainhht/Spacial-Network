"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { gsap } from "gsap";
import {
  REDUCED_TIMING,
  TRAVEL_TIMING,
  type UniverseDestinationId,
} from "./destinations";
import { useUniverseNavigation } from "./UniverseNavigationProvider";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Shows a destination's UI only while the camera is there.
 *
 * Every page overlay of the persistent universe uses this, so no two of them
 * are ever fully visible at once and none of them can be clicked while the
 * camera is moving. The UI is hidden and inert from the moment a move starts,
 * and fades in once the camera has settled at its destination — including when
 * the page mounted in the middle of the move, behind the scene.
 *
 * Returns the attributes to spread on `root`.
 */
export function useDestinationPresence(
  id: UniverseDestinationId,
  root: RefObject<HTMLElement | null>,
  /** Receives focus when the UI is revealed by a move, so keyboard and screen
   * reader users arrive at the new destination rather than at the body. */
  focusOnArrival?: RefObject<HTMLElement | null>,
) {
  const { view } = useUniverseNavigation();
  const visible = view.destination === id && view.phase !== "departing";
  const shown = useRef<boolean | null>(null);
  const tween = useRef<gsap.core.Tween | null>(null);

  // Declared before the effect below so that, when React re-runs effects (Fast
  // Refresh, Strict Mode), the reset lands first and the next run restores the
  // right state instead of assuming the killed tween had finished.
  useLayoutEffect(
    () => () => {
      tween.current?.kill();
      tween.current = null;
      shown.current = null;
    },
    [],
  );

  useLayoutEffect(() => {
    const element = root.current;
    if (!element || shown.current === visible) return;
    const first = shown.current === null;
    shown.current = visible;
    tween.current?.kill();
    const reduced = window.matchMedia(MOTION_QUERY).matches;
    const timing = reduced ? REDUCED_TIMING : TRAVEL_TIMING;

    if (!visible) {
      tween.current = first
        ? gsap.set(element, { opacity: 0 })
        : gsap.to(element, {
            opacity: 0,
            duration: timing.uiOut,
            ease: "power1.out",
          });
      return;
    }
    tween.current = gsap.fromTo(
      element,
      { opacity: 0, y: reduced ? 0 : 10 },
      {
        opacity: 1,
        y: 0,
        duration: timing.uiIn,
        ease: "power2.out",
        // Opacity stays inline: the overlays are transparent in CSS until a
        // presence reveals them (see their stylesheets).
        clearProps: "transform",
        onComplete: () => {
          if (!first) focusOnArrival?.current?.focus({ preventScroll: true });
        },
      },
    );
  }, [visible, root, focusOnArrival]);

  return {
    "data-universe-presence": id,
    "data-universe-phase": view.phase,
    inert: !visible,
  };
}
