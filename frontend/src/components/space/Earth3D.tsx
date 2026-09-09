"use client";

import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bounds, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { createEarthMaterials, SUN_POSITION } from "./earthMaterials";

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

function EarthModel() {
  const { scene } = useGLTF("/models/earth-final.glb");
  const { model, center, scale } = useMemo(() => {
    // Clone the hierarchy so material overrides never mutate useGLTF's cache.
    const model = scene.clone(true);
    const bounds = new Box3().setFromObject(model); //calculate the bounding box of the model
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const extent = Math.max(size.x, size.y, size.z);

    if (!Number.isFinite(extent) || extent <= 0)
      throw new Error("Model has no visible bounds.");
    return { model, center, scale: 2 / extent };
  }, [scene]);

  useLayoutEffect(() => {
    const surface = model.getObjectByName("surface");
    const cloud = model.getObjectByName("cloud");
    const atmo = model.getObjectByName("atmo");
    
    const source = scene.getObjectByName("surface");

    if (
      !(surface instanceof Mesh) ||
      !(cloud instanceof Mesh) ||
      !(atmo instanceof Mesh) ||
      !(source instanceof Mesh) ||
      !(source.material instanceof MeshStandardMaterial) ||
      !source.material.map
    ) {
      throw new Error(
        "Earth requires surface, cloud, atmo meshes and the source coastline map.",
      );
    }

    const materials = createEarthMaterials(source.material.map);
    surface.material = materials.surface;
    cloud.material = materials.cloud;
    atmo.material = materials.atmo;
  
    for (const [shell, factor] of [
      [cloud, 1.008],
      [atmo, 1.025],
    ] as const) {
      shell.position.copy(surface.position);
      shell.quaternion.copy(surface.quaternion);
      shell.scale.copy(surface.scale).multiplyScalar(factor);
    }
    cloud.renderOrder = 1;
    atmo.renderOrder = 2;
    return () => {
      // Cached GLTF textures and geometry belong to useGLTF; dispose only ours.
      Object.values(materials).forEach((material) => material.dispose());
    };
  }, [model, scene]);

  // Frame the large, offset export without changing its geometry or UVs.
  return (
    <group scale={scale} dispose={null}>
      <group position={[-center.x, -center.y, -center.z]}>
        <primitive object={model} />
      </group>
    </group>
  );
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
            <EarthModel />
          </RotatingEarthGroup>
        </Bounds>
      </Suspense>
    </Canvas>
  );
}
