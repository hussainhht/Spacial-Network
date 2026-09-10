"use client";

import { Suspense, type ReactNode } from "react";
import type { DevModel } from "@/components/space/modelsRegistry";
import SceneErrorBoundary from "./SceneErrorBoundary";

export type AssetErrorReporter = (model: DevModel) => void;

/** A failed or pending satellite must not suspend any destination's handles. */
export default function PlanetAsset({
  model,
  onAssetError,
  children,
}: {
  model: DevModel;
  onAssetError: AssetErrorReporter;
  children: ReactNode;
}) {
  return (
    <SceneErrorBoundary
      label={`Unable to load ${model.name} (${model.path}).`}
      onError={() => onAssetError(model)}
    >
      <Suspense fallback={null}>{children}</Suspense>
    </SceneErrorBoundary>
  );
}
