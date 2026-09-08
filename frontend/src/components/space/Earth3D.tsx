"use client";

import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bounds, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { createEarthMaterials, SUN_POSITION } from "./earthMaterials";

export interface Earth3DProps {
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
    const bounds = new Box3().setFromObject(model);
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
    // The source is slightly oblate, with independently rotated shells that
    // intersect. Align only the cloned shells and separate them radially.
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
}: {
  autoRotate?: boolean;
  rotationSpeed?: number;
  children: React.ReactNode;
}) {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * rotationSpeed;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

export default function Earth3D({
  autoRotate = false,
  rotationSpeed = 0.04,
  interactive = true,
  background = "#050816",
  boundsMargin = 1.3,
  ariaLabel = "Interactive Earth model",
}: Earth3DProps = {}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 45, near: 0.01, far: 100 }}
      dpr={[1, 2]}
      frameloop={autoRotate ? "always" : "demand"}
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
        <Bounds fit observe margin={boundsMargin} maxDuration={0}>
          <RotatingEarthGroup
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
