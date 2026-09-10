"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { DevModel } from "@/components/space/modelsRegistry";
import type { UniverseCanvasProps, UniverseSceneHandle } from "../contracts";
import SceneErrorBoundary from "./SceneErrorBoundary";
import UniverseScene from "./UniverseScene";
import {
  HARDWARE_DPR, isSoftwareRenderer, SCENE_CAMERA,
  sceneFrameloop, SOFTWARE_DPR,
} from "./sceneConfig";
import styles from "./UniverseCanvas.module.css";

export default function UniverseCanvas({
  ref,
  className,
  renderActive,
  reducedMotion,
  onSceneReady,
}: UniverseCanvasProps) {
  const [softwareRenderer, setSoftwareRenderer] = useState(false);
  const [failedAssets, setFailedAssets] = useState<readonly string[]>([]);
  const readyCallback = useRef(onSceneReady);
  useLayoutEffect(() => {
    readyCallback.current = onSceneReady;
  }, [onSceneReady]);
  const reportScene = useCallback((handle: UniverseSceneHandle | null) => {
    readyCallback.current(handle);
  }, []);
  const reportAssetError = useCallback((model: DevModel) => {
    setFailedAssets((previous) => previous.includes(model.name) ? previous : [...previous, model.name]);
  }, []);
  const unavailable = (
    <p className={styles.message} role="status">
      The 3D view is unavailable. You can still use the destination links.
    </p>
  );

  return (
    <div ref={ref} className={[styles.stage, className].filter(Boolean).join(" ")} data-universe-canvas-stage>
      <SceneErrorBoundary label="The universe renderer is unavailable." fallback={unavailable}>
        <Canvas
          camera={SCENE_CAMERA}
          dpr={softwareRenderer ? SOFTWARE_DPR : HARDWARE_DPR}
          frameloop={sceneFrameloop(renderActive, reducedMotion)}
          gl={{ alpha: true, antialias: true }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            const context = gl.getContext();
            const debug = context.getExtension("WEBGL_debug_renderer_info");
            const renderer = String(context.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER));
            setSoftwareRenderer(isSoftwareRenderer(renderer));
          }}
          fallback={unavailable}
          aria-label="Earth and its orbiting Moon, Mars, and Saturn"
        >
          <UniverseScene
            renderActive={renderActive}
            reducedMotion={reducedMotion}
            onSceneReady={reportScene}
            onAssetError={reportAssetError}
          />
        </Canvas>
      </SceneErrorBoundary>
      {failedAssets.length > 0 && (
        <p className={styles.message} role="status">
          Unable to display {failedAssets.join(", ")}. Destination links are still available.
        </p>
      )}
    </div>
  );
}
