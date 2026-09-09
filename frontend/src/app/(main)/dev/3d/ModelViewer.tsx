"use client";

import { Suspense, useLayoutEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, DoubleSide, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { createEarthMaterials } from "@/components/space/earthMaterials";
import type { DevModel } from "./modelsRegistry";

interface ModelViewerProps {
  model: DevModel;
}

/**
 * Isolated Earth model component preserving custom shaders,
 * procedural clouds, and atmospheric scattering.
 */
function EarthPlanetModel({ modelConfig }: { modelConfig: DevModel }) {
  const { scene } = useGLTF(modelConfig.path);

  const { model, center, scale } = useMemo(() => {
    // Clone hierarchy so material overrides never mutate useGLTF cache
    const model = scene.clone(true);
    const bounds = new Box3().setFromObject(model);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const extent = Math.max(size.x, size.y, size.z);

    if (!Number.isFinite(extent) || extent <= 0) {
      throw new Error("Earth model has no visible bounds.");
    }

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
      throw new Error("Earth requires surface, cloud, atmo meshes and the source coastline map.");
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
      Object.values(materials).forEach((mat) => mat.dispose());
    };
  }, [model, scene]);

  return (
    <group scale={scale} dispose={null}>
      <group position={[-center.x, -center.y, -center.z]}>
        <primitive object={model} />
      </group>
    </group>
  );
}

/**
 * Generic planet model component for Moon, Mars, Saturn, and future planets.
 * Preserves original materials, textures, alpha transparency, and ring geometry.
 */
function GenericPlanetModel({ modelConfig }: { modelConfig: DevModel }) {
  const { scene } = useGLTF(modelConfig.path);

  const { model, center, scale } = useMemo(() => {
    // Clone scene to avoid mutating GLTF loader cache
    const model = scene.clone(true);

    // For Saturn, ensure both ring planes are double-sided and alpha-blended cleanly
    if (modelConfig.id === "saturn") {
      model.traverse((child) => {
        if (child instanceof Mesh && child.material) {
          if (child.material.name === "SaturnRings") {
            child.material = child.material.clone();
            child.material.side = DoubleSide;
            child.material.transparent = true;
            child.material.depthWrite = false;
          }
        }
      });
    }

    const bounds = new Box3().setFromObject(model);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const extent = Math.max(size.x, size.y, size.z);

    if (!Number.isFinite(extent) || extent <= 0) {
      throw new Error(`Model "${modelConfig.name}" has no visible bounds.`);
    }

    const baseScale = (modelConfig.defaultScale ?? 1) * (2 / extent);
    return { model, center, scale: baseScale };
  }, [scene, modelConfig]);

  const rotation = modelConfig.defaultRotation ?? [0, 0, 0];

  return (
    <group rotation={rotation} scale={scale} dispose={null}>
      <group position={[-center.x, -center.y, -center.z]}>
        <primitive object={model} />
      </group>
    </group>
  );
}

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
            {model.id === "earth" ? (
              <EarthPlanetModel modelConfig={model} />
            ) : (
              <GenericPlanetModel modelConfig={model} />
            )}
          </group>
        </Bounds>
      </Suspense>
    </Canvas>
  );
}

