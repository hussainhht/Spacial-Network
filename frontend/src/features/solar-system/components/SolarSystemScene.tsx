"use client";

import { useCallback, useMemo, useRef, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import type { Object3D } from "three";
import { solveFraming } from "../config/composition";
import { PLANETS, SUN, type PlanetId } from "../config/planets";
import type { CameraRig } from "../navigation/cameraPose";
import Planet, { type BodyRegistrar } from "./Planet";
import PlanetOrbit from "./PlanetOrbit";
import type { AssetErrorReporter } from "./PlanetModel";
import SolarLighting from "./SolarLighting";
import Sun from "./Sun";
import UniverseCameraController from "./UniverseCameraController";

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
  rigRef,
  onAssetError,
}: {
  animate: boolean;
  rigRef: RefObject<CameraRig>;
  onAssetError: AssetErrorReporter;
}) {
  const size = useThree((state) => state.size);
  const framing = useMemo(
    () => solveFraming(size.width, size.height),
    [size.width, size.height],
  );

  // Read only inside the camera's frame callback, so it is a plain mutable map
  // rather than state: a body arriving must not re-render the scene.
  const bodiesRef = useRef(new Map<PlanetId, Object3D>());
  const registerBody = useCallback<BodyRegistrar>((id, node) => {
    bodiesRef.current.set(id, node);
    return () => {
      if (bodiesRef.current.get(id) === node) bodiesRef.current.delete(id);
    };
  }, []);

  return (
    <>
      <SolarLighting spread={framing.spread} />
      <Sun radius={SUN.radius} animate={animate} onAssetError={onAssetError} />
      <PlanetOrbit spread={framing.spread} rigRef={rigRef} />
      {PLANETS.map((planet) => (
        <Planet
          key={planet.id}
          planet={planet}
          spread={framing.spread}
          animate={animate}
          registerBody={registerBody}
          onAssetError={onAssetError}
        />
      ))}
      <UniverseCameraController
        framing={framing}
        rigRef={rigRef}
        bodiesRef={bodiesRef}
      />
    </>
  );
}
