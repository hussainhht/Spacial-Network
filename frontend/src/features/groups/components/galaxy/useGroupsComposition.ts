"use client";

import { useLayoutEffect, type RefObject } from "react";
import { groupsComposition } from "@/features/universe-home/scene/groupsStage";

/**
 * Publishes the shared Groups composition onto the pane as custom properties.
 *
 * The 3D scene reads the same anchors through `measureSceneFraming`, from the
 * same pixel box — the docked viewport, which is this pane. Going through CSS
 * variables rather than React state is deliberate: a resize then costs one style
 * write instead of a render, and the galaxy's geometry can never be a frame
 * behind the planet that is supposed to be standing in it.
 */
export function useGroupsComposition(pane: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = pane.current;
    if (!element) return;
    const apply = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      // A 0x0 pane measures to a degenerate composition; the scene declines to
      // dock into one too, so there is nothing to publish yet.
      if (width <= 0 || height <= 0) return;
      const composition = groupsComposition(width, height);
      const style = element.style;
      style.setProperty("--groups-star-x", `${composition.star.x}px`);
      style.setProperty("--groups-star-y", `${composition.star.y}px`);
      style.setProperty("--groups-galaxy", `${composition.galaxy}px`);
      style.setProperty("--groups-mars-x", `${composition.mars.x}px`);
      style.setProperty("--groups-mars-y", `${composition.mars.y}px`);
      style.setProperty("--groups-mars-size", `${composition.mars.diameter}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => observer.disconnect();
  }, [pane]);
}
