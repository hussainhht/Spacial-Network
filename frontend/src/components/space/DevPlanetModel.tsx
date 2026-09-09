"use client";

import { useLayoutEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, DoubleSide, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { createEarthMaterials } from "./earthMaterials";
import type { DevModel } from "./modelsRegistry";

/**
 * Isolated Earth model component preserving custom shaders,
 * procedural clouds, and atmospheric scattering.
 */
export function EarthPlanetModel({ modelConfig }: { modelConfig: DevModel }) {
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
export function GenericPlanetModel({ modelConfig }: { modelConfig: DevModel }) {
  const { scene } = useGLTF(modelConfig.path);

  const { model, center, scale } = useMemo(() => {
    // Clone scene to avoid mutating GLTF loader cache
    const model = scene.clone(true);

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

  useLayoutEffect(() => {
    if (modelConfig.id !== "saturn") return;
    const restore: (() => void)[] = [];
    model.traverse((child) => {
      if (!(child instanceof Mesh) || Array.isArray(child.material) || child.material.name !== "SaturnRings") return;
      const source = child.material;
      const material = source.clone();
      material.side = DoubleSide;
      material.transparent = true;
      material.depthWrite = false;
      child.material = material;
      restore.push(() => { child.material = source; material.dispose(); });
    });
    return () => restore.forEach((dispose) => dispose());
  }, [model, modelConfig.id]);

  const rotation = modelConfig.defaultRotation ?? [0, 0, 0];

  return (
    <group rotation={rotation} scale={scale} dispose={null}>
      <group position={[-center.x, -center.y, -center.z]}>
        <primitive object={model} />
      </group>
    </group>
  );
}

export default function DevPlanetModel({ modelConfig }: { modelConfig: DevModel }) {
  return modelConfig.id === "earth"
    ? <EarthPlanetModel modelConfig={modelConfig} />
    : <GenericPlanetModel modelConfig={modelConfig} />;
}
