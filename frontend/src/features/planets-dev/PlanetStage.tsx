"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Html } from "@react-three/drei";
import { SUN_POSITION } from "@/components/space/earthMaterials";
import PlanetModel from "./PlanetModel";
import { planets } from "./planetConfig";

export default function PlanetStage() {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 12], near: 0.1, far: 100 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      aria-label="Earth, Moon, Mars and Saturn slowly rotating"
      fallback={<p role="alert">WebGL is unavailable. Enable hardware acceleration to preview the planets.</p>}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={SUN_POSITION} intensity={2.4} />
      <directionalLight position={[4, -1.5, -3]} intensity={0.5} />
      <Suspense fallback={<Html center><p role="status" style={{ whiteSpace: "nowrap" }}>Loading planets…</p></Html>}>
        <Bounds fit observe margin={1.25} maxDuration={0}>
          {planets.map((planet) => <PlanetModel key={planet.id} planet={planet} />)}
        </Bounds>
        {planets.map((planet) => (
          <Html key={planet.id} center position={[planet.position[0], -2.4, 0]} style={{ pointerEvents: "none" }}>
            <span style={{ color: "#acb7cc", fontSize: 11, letterSpacing: "0.2em" }}>{planet.label.toUpperCase()}</span>
          </Html>
        ))}
      </Suspense>
    </Canvas>
  );
}
