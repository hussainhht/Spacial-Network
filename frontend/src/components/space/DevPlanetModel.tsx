"use client";

import { useLayoutEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, DoubleSide, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { createEarthMaterials } from "./earthMaterials";
import { EARTH_MODEL_PATH, type DevModel } from "./modelsRegistry";

/**
 * Isolated Earth model component preserving custom shaders,
 * procedural clouds, and atmospheric scattering.
 */
export function EarthPlanetModel() {
  const { scene } = useGLTF(EARTH_MODEL_PATH);

  const { model, center, scale } = useMemo(() => {
    // Read export transforms without changing cached materials or geometry.
    scene.updateMatrixWorld(true);
    const source = scene.getObjectByName("Surface_Material001_0");
    if (!(source instanceof Mesh)) throw new Error("Earth surface mesh is missing.");
    // Flatten the export hierarchy and reuse its surface geometry for the existing
    // procedural shells. Exported opaque atmosphere meshes must not cover it.
    const model = new Group();
    for (const name of ["surface", "cloud", "atmo"]) {
      const mesh = source.clone();
      mesh.name = name;
      source.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
      // Keep the original Earth tilt and procedural cloud orientation.
      mesh.quaternion.set(-0.135598958, 0.9884727, -0.0124000078, 0.0661882833).normalize();
      model.add(mesh);
    }
    const bounds = new Box3().setFromObject(model);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const extent = Math.max(size.x, size.y, size.z);

    if (!Number.isFinite(extent) || extent <= 0) {
      throw new Error("Earth model has no visible bounds.");
    }

    // Match the previous visible diameter (1221.13) inside its export bounds (1938.60).
    const diameter = new Box3().setFromObject(model, true).getSize(new Vector3());
    return { model, center, scale: (2 * 1221.1297423308124 / 1938.6019216974796) / Math.max(diameter.x, diameter.y, diameter.z) };
  }, [scene]);

  useLayoutEffect(() => {
    const surface = model.getObjectByName("surface");
    const cloud = model.getObjectByName("cloud");
    const atmo = model.getObjectByName("atmo");
    const source = scene.getObjectByName("Surface_Material001_0");

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
    if (modelConfig.id === "saturn") {
      // Undo the export's baked ring tilt before applying the existing page tilt.
      model.updateMatrixWorld(true);
      const ring = model.getObjectByName("ring_rings_0");
      if (!(ring instanceof Mesh)) throw new Error("Saturn ring mesh is missing.");
      const correction = ring.getWorldQuaternion(new Quaternion()).invert();
      correction.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2));
      model.quaternion.premultiply(correction);
      const body = model.getObjectByName("saturn_Planet_0");
      if (!(body instanceof Mesh)) throw new Error("Saturn body mesh is missing.");
      model.updateMatrixWorld(true);
      const ringSize = new Box3().setFromObject(ring, true).getSize(new Vector3());
      const bodySize = new Box3().setFromObject(body, true).getSize(new Vector3());
      // Retain the old body's diameter relative to the full ring span.
      body.scale.multiplyScalar((1000 / 2330.9010009765625) *
        Math.max(ringSize.x, ringSize.y, ringSize.z) / Math.max(bodySize.x, bodySize.y, bodySize.z));
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

  useLayoutEffect(() => {
    if (modelConfig.id !== "saturn") return;
    const restore: (() => void)[] = [];
    model.traverse((child) => {
      if (!(child instanceof Mesh) || Array.isArray(child.material) || child.material.name !== "rings") return;
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
    ? <EarthPlanetModel />
    : <GenericPlanetModel modelConfig={modelConfig} />;
}
