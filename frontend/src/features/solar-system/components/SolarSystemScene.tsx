"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { solveFraming } from "../config/composition";
import { PLANETS, SUN } from "../config/planets";
import Planet from "./Planet";
import PlanetOrbit from "./PlanetOrbit";
import type { AssetErrorReporter } from "./PlanetModel";
import SolarCamera from "./SolarCamera";
import SolarLighting from "./SolarLighting";
import Sun from "./Sun";

/**
 * The solar system.
 *
 * The scene measures the pane once per resize and hands the result down; no
 * child measures anything itself, so every body is placed against one set of
 * numbers and the composition cannot come apart at a breakpoint.
 *
 * Deliberately absent: the stars. They are the app's existing `SpaceBackground`
 * layer behind the canvas — no second starfield, and no geometry in here that
 * exists only to be far away.
 */
export default function SolarSystemScene({
  animate,
  onAssetError,
}: {
  animate: boolean;
  onAssetError: AssetErrorReporter;
}) {
  const size = useThree((state) => state.size);
  const framing = useMemo(
    () => solveFraming(size.width, size.height),
    [size.width, size.height],
  );

  return (
    <>
      <SolarCamera framing={framing} />
      <SolarLighting spread={framing.spread} />
      <Sun radius={SUN.radius} animate={animate} onAssetError={onAssetError} />
      <PlanetOrbit spread={framing.spread} />
      {PLANETS.map((planet) => (
        <Planet
          key={planet.id}
          planet={planet}
          spread={framing.spread}
          animate={animate}
          onAssetError={onAssetError}
        />
      ))}
    </>
  );
}
