"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Html, OrbitControls } from "@react-three/drei";
import DevPlanetModel from "@/components/space/DevPlanetModel";
import type { DevModel } from "./modelsRegistry";

interface ModelViewerProps { model: DevModel; }

/**
 * Unified 3D Model Viewer using ONE Canvas instance.
 * Automatically fits, centers, and balances lighting for inspection.
 */
export default function ModelViewer({ model }: ModelViewerProps) {
  const [softwareRenderer, setSoftwareRenderer] = useState(false);

  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 45, near: 0.01, far: 100 }}
      dpr={softwareRenderer ? 0.5 : [1, 2]}
      frameloop="demand"
      onCreated={({ gl }) => {
        const context = gl.getContext();
        const debug = context.getExtension("WEBGL_debug_renderer_info");
        const renderer = debug
          ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL))
          : "";
        setSoftwareRenderer(/swiftshader|llvmpipe|software/i.test(renderer));
      }}
      gl={{ antialias: true, alpha: false }}
      fallback={
        <p role="alert">
          WebGL is unavailable. Enable hardware acceleration or use a WebGL-capable browser.
        </p>
      }
      aria-label={`Interactive 3D model of ${model.name}`}
    >
      <color attach="background" args={["#050816"]} />

      {/* Balanced inspection lighting: illuminated features on day side, visible detail on night side */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[-4, 2, 3]} intensity={2.4} />
      <directionalLight position={[4, -1.5, -3]} intensity={0.65} />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableRotate
        enableZoom
        minDistance={1.2}
        maxDistance={15}
      />

      <Suspense
        fallback={
          <Html center>
            <p role="status" style={{ color: "#d8def0", whiteSpace: "nowrap" }}>
              Loading {model.name}...
            </p>
          </Html>
        }
      >
        <Bounds fit observe margin={model.boundsMargin ?? 1.3} maxDuration={0.3}>
          <group key={model.id}>
            <DevPlanetModel modelConfig={model} />
          </group>
        </Bounds>
      </Suspense>
    </Canvas>
  );
}

