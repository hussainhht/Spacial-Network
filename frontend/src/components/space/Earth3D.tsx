"use client";

import { Suspense, useLayoutEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bounds, Html, OrbitControls } from "@react-three/drei";
import { Group, Vector3 } from "three";
import { SUN_POSITION } from "./earthMaterials";

import { EarthPlanetModel } from "./DevPlanetModel";

import type { EarthHandle } from "@/features/universe-transition/types";

export interface Earth3DProps {
  transitionActive?: boolean;
  renderActive?: boolean;
  onTransitionReady?: (handle: EarthHandle | null) => void;
  autoRotate?: boolean;
  rotationSpeed?: number;
  interactive?: boolean;
  background?: string | null;
  boundsMargin?: number;
  ariaLabel?: string;
}

function RotatingEarthGroup({
  autoRotate,
  rotationSpeed = 0.04,
  children,
  onTransitionReady,
}: {
  autoRotate?: boolean;
  rotationSpeed?: number;
  children: React.ReactNode;
  onTransitionReady?: (handle: EarthHandle | null) => void;
}) {
  const groupRef = useRef<Group>(null);
  const transitionRef = useRef<Group>(null);
  const motion = useRef({ speed: rotationSpeed });
  const get = useThree((state) => state.get);
  useLayoutEffect(() => {
    if (!transitionRef.current) return;
    onTransitionReady?.({
      group: transitionRef.current,
      motion: motion.current,
      unitsPerPixel: () => {
        const state = get();
        return (
          state.viewport.getCurrentViewport(state.camera, new Vector3()).width /
          state.size.width
        );
      },
    });
    return () => onTransitionReady?.(null);
  }, [get, onTransitionReady]);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * motion.current.speed;
    }
  });

  return (
    <group ref={transitionRef}>
      <group ref={groupRef}>{children}</group>
    </group>
  );
}

export default function Earth3D({
  onTransitionReady,
  transitionActive = false,
  renderActive,
  autoRotate = false,
  rotationSpeed = 0.04,
  interactive = true,
  background = "#050816",
  boundsMargin = 1.3,
  ariaLabel = "Interactive Earth model",
}: Earth3DProps = {}) {
  const [softwareRenderer, setSoftwareRenderer] = useState(false);
  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 45, near: 0.01, far: 100 }}
      // Declarative configuration survives Canvas's own resize/reparent renders.
      // Imperative setDpr/setFrameloop here would be overwritten by Canvas props.
      dpr={transitionActive ? (softwareRenderer ? 0.5 : 1) : [1, 2]}
      frameloop={(renderActive ?? autoRotate) ? "always" : "demand"}
      onCreated={({ gl }) => {
        const context = gl.getContext();
        const debug = context.getExtension("WEBGL_debug_renderer_info");
        const renderer = debug
          ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL))
          : "";
        setSoftwareRenderer(/swiftshader|llvmpipe|software/i.test(renderer));
      }}
      gl={{ alpha: !background, antialias: true }}
      fallback={
        <p role="alert">
          WebGL is unavailable. Enable hardware acceleration or use a
          WebGL-capable browser.
        </p>
      }
      aria-label={ariaLabel}
    >
      {background && <color attach="background" args={[background]} />}
      <ambientLight intensity={0.12} />
      <directionalLight position={SUN_POSITION} intensity={3} />
      {interactive && (
        <OrbitControls
          makeDefault
          enablePan={false}
          enableRotate
          enableZoom
          minDistance={1.5}
          maxDistance={12}
        />
      )}
      <Suspense
        fallback={
          <Html center>
            <p role="status" style={{ color: "#d8def0", whiteSpace: "nowrap" }}>
              Loading 3D model...
            </p>
          </Html>
        }
      >
        <Bounds
          fit
          observe={!onTransitionReady}
          margin={boundsMargin}
          maxDuration={0}
        >
          <RotatingEarthGroup
            onTransitionReady={onTransitionReady}
            autoRotate={autoRotate}
            rotationSpeed={rotationSpeed}
          >
            <EarthPlanetModel />
          </RotatingEarthGroup>
        </Bounds>
      </Suspense>
    </Canvas>
  );
}
