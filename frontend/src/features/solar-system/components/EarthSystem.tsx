"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import {
  EARTH_MODEL_SCALE,
  MAX_FRAME_DELTA,
  MOON,
  MOON_MODEL,
  type PlanetConfig,
} from "../config/planets";
import PlanetModel, { type AssetErrorReporter } from "./PlanetModel";

/**
 * Earth and its Moon, as one object.
 *
 * Everything below is expressed in Earth radii and scaled once at the root, so
 * the satellite keeps its distance and its proportion to its parent at every
 * breakpoint. That is the point of the grouping: the Moon can never drift into
 * looking like an unrelated small planet that happens to be nearby, because it
 * is not positioned in world space at all.
 *
 *   EarthSystem            scaled to the display radius
 *   ├─ EarthAxis           axial tilt, fixed
 *   │  └─ EarthSpin        turns about that tilted axis
 *   └─ MoonInclination     the orbit's tilt out of the ecliptic
 *      └─ MoonOrbit        carries the Moon round
 *         └─ MoonSpin
 *
 * Each transform has exactly one writer, so the orbit and the two spins never
 * contend for the same value.
 */
export default function EarthSystem({
  planet,
  radius,
  animate,
  onAssetError,
}: {
  planet: PlanetConfig;
  /** Earth's display radius in world units. */
  radius: number;
  animate: boolean;
  onAssetError: AssetErrorReporter;
}) {
  const earthSpin = useRef<Group>(null);
  const moonOrbit = useRef<Group>(null);
  const moonSpin = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!animate) return;
    const step = Math.min(delta, MAX_FRAME_DELTA);
    if (earthSpin.current)
      earthSpin.current.rotation.y += step * planet.spinSpeed;
    if (moonOrbit.current)
      moonOrbit.current.rotation.y += step * MOON.orbitSpeed;
    if (moonSpin.current) moonSpin.current.rotation.y += step * MOON.spinSpeed;
  });

  return (
    <group name="EarthSystem" scale={radius}>
      <group
        name="EarthAxis"
        rotation-y={(planet.tiltDirection * Math.PI) / 180}
      >
        <group rotation-z={planet.axialTilt}>
          <group ref={earthSpin} name="EarthSpin">
            {/* The Earth model normalizes to bounds wider than its visible
                globe; this is the compensation that makes its surface radius
                exactly 1. */}
            <group scale={EARTH_MODEL_SCALE}>
              <PlanetModel model={planet.model} onAssetError={onAssetError} />
            </group>
          </group>
        </group>
      </group>
      <group name="MoonInclination" rotation-x={MOON.orbitInclination}>
        <group ref={moonOrbit} name="MoonOrbit" rotation-y={MOON.orbitPhase}>
          <group name="MoonOffset" position-x={MOON.orbitRadius}>
            <group ref={moonSpin} name="MoonSpin" scale={MOON.radius}>
              <PlanetModel model={MOON_MODEL} onAssetError={onAssetError} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
