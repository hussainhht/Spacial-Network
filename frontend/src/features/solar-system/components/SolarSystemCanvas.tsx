"use client";

import { useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { DevModel } from "@/components/space/modelsRegistry";
import SceneErrorBoundary from "@/features/universe-home/scene/SceneErrorBoundary";
import {
  HARDWARE_DPR,
  isSoftwareRenderer,
  NEAR_PLANE,
  SOFTWARE_DPR,
} from "../config/composition";
import SolarSystemScene from "./SolarSystemScene";
import styles from "../styles/SolarSystemCanvas.module.css";

/**
 * The renderer for the home scene.
 *
 * One WebGL context, and it is transparent: the stars behind it are the app's
 * existing DOM starfield, which costs no texture, no geometry and no frame time.
 * Everything drawn here is a body of the solar system.
 */
export default function SolarSystemCanvas({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) {
  const [softwareRenderer, setSoftwareRenderer] = useState(false);
  const [failedAssets, setFailedAssets] = useState<readonly string[]>([]);

  const reportAssetError = useCallback((model: DevModel) => {
    setFailedAssets((previous) =>
      previous.includes(model.name) ? previous : [...previous, model.name],
    );
  }, []);

  const unavailable = (
    <p className={styles.message} role="status">
      The 3D view is unavailable on this device.
    </p>
  );

  return (
    <div className={styles.stage} data-solar-stage>
      <SceneErrorBoundary
        label="Solar system: the renderer is unavailable."
        fallback={unavailable}
      >
        <Canvas
          // Replaced immediately by `SolarCamera` against the measured pane;
          // this only keeps the first frame from being built at a default fov.
          camera={{
            position: [6, 17.7, 31.1],
            fov: 30,
            near: NEAR_PLANE,
            far: 300,
          }}
          dpr={softwareRenderer ? SOFTWARE_DPR : HARDWARE_DPR}
          // Nothing here responds to input, so a still scene is genuinely still:
          // a reduced-motion reader gets the composition and no render loop.
          frameloop={reducedMotion ? "demand" : "always"}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            const context = gl.getContext();
            const debug = context.getExtension("WEBGL_debug_renderer_info");
            const renderer = String(
              context.getParameter(
                debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER,
              ),
            );
            setSoftwareRenderer(isSoftwareRenderer(renderer));
          }}
          fallback={unavailable}
          aria-label="The Sun with Mercury, Venus, Earth and its Moon, Mars, Jupiter, Saturn and Uranus on their orbits"
        >
          <SolarSystemScene
            animate={!reducedMotion}
            onAssetError={reportAssetError}
          />
        </Canvas>
      </SceneErrorBoundary>
      {failedAssets.length > 0 && (
        <p className={styles.message} role="status">
          Unable to display {failedAssets.join(", ")}.
        </p>
      )}
    </div>
  );
}
