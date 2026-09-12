"use client";

import { Suspense, useLayoutEffect, useRef, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import type { Group } from "three";
import DevPlanetModel from "@/components/space/DevPlanetModel";
import type { DevModel } from "@/components/space/modelsRegistry";
import SceneErrorBoundary from "@/features/universe-home/scene/SceneErrorBoundary";
import { sunlitOnly } from "./planetMaterials";

export type AssetErrorReporter = (model: DevModel) => void;

/**
 * One loaded body.
 *
 * The renderers, the normalization and the Earth shaders are the project's
 * existing ones. This adds the three things a system of nine bodies needs that a
 * single-model page does not: a body that fails to load must not take the rest
 * of the system down with it, a body still downloading must not suspend its
 * neighbours — which is what makes the scene appear progressively rather than
 * all at once — and every body must answer to the same star.
 */
export default function PlanetModel({
  model,
  onAssetError,
}: {
  model: DevModel;
  onAssetError: AssetErrorReporter;
}) {
  const root = useRef<Group>(null);

  return (
    <SceneErrorBoundary
      label={`Solar system: unable to load ${model.name} (${model.path}).`}
      onError={() => onAssetError(model)}
    >
      <Suspense fallback={null}>
        <group ref={root}>
          <DevPlanetModel modelConfig={model} />
        </group>
        {/* A sibling inside the boundary, not a wrapper around it. React commits
            a suspended subtree and its later siblings together, so this effect
            runs with the model already attached — where the same effect on a
            parent would have run once, before the download finished. */}
        <SunlitMaterials target={root} model={model} />
      </Suspense>
    </SceneErrorBoundary>
  );
}

function SunlitMaterials({
  target,
  model,
}: {
  target: RefObject<Group | null>;
  model: DevModel;
}) {
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    if (!target.current) return;
    const restore = sunlitOnly(target.current);
    // A reduced-motion scene draws on demand, so the body that just arrived has
    // to ask for the frame that shows it. Without this the reader who asked for
    // less motion would be looking at the orbits alone.
    invalidate();
    return restore;
  }, [target, model, invalidate]);
  return null;
}
