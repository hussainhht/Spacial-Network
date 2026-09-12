"use client";

import { SUN_LIGHT } from "../config/composition";

/**
 * The whole exposure of the scene, in one place.
 *
 * The Sun is the light: one point light at the origin, which is what gives every
 * body a lit face, a terminator and a dark side, and what makes the system read
 * as one object rather than as eight pictures of planets. The two fills below it
 * exist only so a dark limb still separates from the black behind it — they are
 * an order of magnitude weaker, and if either is raised far enough to be noticed
 * on its own the terminators start to flatten.
 */
export default function SolarLighting({ spread }: { spread: number }) {
  return (
    <>
      <pointLight
        name="SunLight"
        position={[0, 0, 0]}
        color={SUN_LIGHT.color}
        // Compensated for the responsive spread, so drawing the orbits in on a
        // narrow pane does not also brighten every planet on it.
        intensity={SUN_LIGHT.intensity * Math.pow(spread, SUN_LIGHT.decay)}
        // A gentle falloff rather than the physical inverse square: enough that
        // the inner system reads as nearer the fire, not so much that Uranus
        // disappears.
        decay={SUN_LIGHT.decay}
        distance={0}
      />
      <ambientLight intensity={0.08} />
      <hemisphereLight args={["#1b2b4a", "#05070d", 0.18]} />
    </>
  );
}
