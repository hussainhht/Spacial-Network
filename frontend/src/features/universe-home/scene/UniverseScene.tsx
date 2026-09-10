"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { SUN_POSITION } from "@/components/space/earthMaterials";
import type { UniverseCanvasProps } from "../contracts";
import { PLANET_ORDER } from "../navigation/planetDestinations";
import PlanetRig, { createPlanetRigs } from "./PlanetRig";
import type { AssetErrorReporter } from "./PlanetAsset";
import { measureSceneFraming } from "./sceneConfig";

const RIG_PLANE = new Vector3(0, 0, 0);

export default function UniverseScene({
  renderActive,
  reducedMotion,
  onSceneReady,
  onAssetError,
}: Pick<UniverseCanvasProps, "renderActive" | "reducedMotion" | "onSceneReady"> & {
  onAssetError: AssetErrorReporter;
}) {
  const [rigs] = useState(() => createPlanetRigs(PLANET_ORDER));
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const getViewport = useThree((state) => state.viewport.getCurrentViewport);
  const invalidate = useThree((state) => state.invalidate);
  const { width, height } = getViewport(camera, RIG_PLANE, size);
  const framing = useMemo(() => measureSceneFraming(width, height), [width, height]);

  // Separate teardown from dimension publication: a resize never emits a
  // transient null handle or recreates Groups while the motion owner restores x.
  useLayoutEffect(() => () => onSceneReady(null), [onSceneReady]);
  useLayoutEffect(() => {
    if (width <= 0 || height <= 0) return;
    onSceneReady({
      rigs,
      viewportWidth: width,
      viewportHeight: height,
      spacing: framing.spacing,
      invalidate,
    });
  }, [rigs, width, height, framing.spacing, invalidate, onSceneReady]);

  useLayoutEffect(() => {
    // Wake a static canvas on return to Home or a live preference change.
    if (renderActive) invalidate();
  }, [renderActive, reducedMotion, width, height, invalidate]);

  return (
    <>
      <ambientLight intensity={0.12} />
      <directionalLight position={SUN_POSITION} intensity={3} />
      {PLANET_ORDER.map((id) => (
        <PlanetRig
          key={id}
          rig={rigs.get(id)!}
          framing={framing}
          animate={renderActive && !reducedMotion}
          onAssetError={onAssetError}
        />
      ))}
    </>
  );
}
