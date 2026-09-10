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
  phase,
  stage,
  onSceneReady,
  onPlanetActivate,
  onAssetError,
}: Pick<
  UniverseCanvasProps,
  | "renderActive"
  | "reducedMotion"
  | "phase"
  | "stage"
  | "onSceneReady"
  | "onPlanetActivate"
> & {
  onAssetError: AssetErrorReporter;
}) {
  const [rigs] = useState(() => createPlanetRigs(PLANET_ORDER));
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const getViewport = useThree((state) => state.viewport.getCurrentViewport);
  const invalidate = useThree((state) => state.invalidate);
  const { width, height } = getViewport(camera, RIG_PLANE, size);
  const framing = useMemo(
    () => measureSceneFraming(width, height, size.width, size.height),
    [width, height, size.width, size.height],
  );

  // Published once, and carrying no measurements: a resize re-frames the scene
  // in place instead of handing the motion layer a new handle, which used to
  // tear down and rebuild the entire scroll machinery mid-gesture.
  useLayoutEffect(() => {
    onSceneReady({ invalidate });
    return () => onSceneReady(null);
  }, [invalidate, onSceneReady]);

  useLayoutEffect(() => {
    // Wake a static canvas on return to Home, a resize or a preference change.
    if (renderActive) invalidate();
  }, [renderActive, reducedMotion, framing, invalidate]);

  return (
    <>
      <ambientLight intensity={0.12} />
      <directionalLight position={SUN_POSITION} intensity={3} />
      {PLANET_ORDER.map((id, index) => (
        <PlanetRig
          key={id}
          rig={rigs.get(id)!}
          index={index}
          count={PLANET_ORDER.length}
          phase={phase}
          stage={stage}
          framing={framing}
          animate={renderActive && !reducedMotion}
          onAssetError={onAssetError}
          onActivate={onPlanetActivate}
        />
      ))}
    </>
  );
}
