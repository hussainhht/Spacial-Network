"use client";

import { useLayoutEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import {
  Box3,
  DoubleSide,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import { createEarthMaterials } from "./earthMaterials";
import { EARTH_MODEL_PATH, type SpaceModel } from "./modelsRegistry";

// Both meshes are exported as concentric, correctly-sized spheres (Clouds is
// already authored a bit larger than Earth), so each keeps its own geometry
// and radius. Only the base orientation is overridden, and identically for
// both, so the cloud texture stays aligned with the surface texture beneath
// it. The Sketchfab export's own pole axis points at the camera (+Z); this
// +90° X rotation lays it onto world +Y instead, matching AxialRotation's
// Y-axis spin (PlanetMotion.tsx) so the globe turns on its real polar axis
// with the equator running horizontally, poles at top/bottom.
const EARTH_TILT = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0));

/**
 * Isolated Earth model component preserving custom shaders and atmospheric
 * scattering. Surface and clouds render their own baked source textures;
 * only the atmosphere shell has no baked counterpart and stays procedural.
 */
function EarthPlanetModel() {
  const { scene } = useGLTF(EARTH_MODEL_PATH);

  const { model, center, scale } = useMemo(() => {
    // Read export transforms without changing cached materials or geometry.
    scene.updateMatrixWorld(true);
    const earthSource = scene.getObjectByName("Earth_Earth_0");
    if (!(earthSource instanceof Mesh)) {
      throw new Error("Earth surface mesh is missing.");
    }
    // Clouds are optional: render without them if the model doesn't have one.
    const cloudSource = scene.getObjectByName("Clouds_Clouds_0");
    const hasCloud = cloudSource instanceof Mesh;

    const model = new Group();
    let atmoMesh: Mesh | undefined;
    const shellSources: ReadonlyArray<readonly [string, Mesh]> = [
      ["surface", earthSource],
      ...(hasCloud ? ([["cloud", cloudSource]] as const) : []),
      ["atmo", earthSource],
    ];
    for (const [name, source] of shellSources) {
      const mesh = source.clone();
      mesh.name = name;
      source.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
      mesh.quaternion.copy(EARTH_TILT);
      model.add(mesh);
      if (name === "atmo") atmoMesh = mesh;
    }
    // Atmosphere has no baked geometry of its own: push it outward a little
    // past the (already correctly sized) cloud shell.
    atmoMesh?.scale.multiplyScalar(1.025);

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
    const atmo = model.getObjectByName("atmo");
    const earthSource = scene.getObjectByName("Earth_Earth_0");

    if (
      !(surface instanceof Mesh) ||
      !(atmo instanceof Mesh) ||
      !(earthSource instanceof Mesh) ||
      !(earthSource.material instanceof MeshStandardMaterial) ||
      !earthSource.material.map
    ) {
      throw new Error("Earth requires surface and atmo meshes and the source map.");
    }

    // Clouds are optional: only wired up when both the shell and its source
    // texture are present.
    const cloud = model.getObjectByName("cloud");
    const cloudSource = scene.getObjectByName("Clouds_Clouds_0");
    const cloudMap =
      cloudSource instanceof Mesh &&
      cloudSource.material instanceof MeshStandardMaterial &&
      cloudSource.material.map
        ? cloudSource.material.map
        : undefined;

    const materials = createEarthMaterials(earthSource.material.map, cloudMap);
    surface.material = materials.surface;
    atmo.material = materials.atmo;
    atmo.renderOrder = 2;

    if (cloud instanceof Mesh && materials.cloud) {
      cloud.material = materials.cloud;
      cloud.renderOrder = 1;
    }

    return () => {
      materials.surface.dispose();
      materials.atmo.dispose();
      materials.cloud?.dispose();
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
function GenericPlanetModel({ modelConfig }: { modelConfig: SpaceModel }) {
  const { scene } = useGLTF(modelConfig.modelPath);

  const { model, center, scale } = useMemo(() => {
    // Clone scene to avoid mutating GLTF loader cache
    const model = scene.clone(true);
    if (modelConfig.id === "saturn") {
      // Undo the export's baked ring tilt before applying the model's configured tilt.
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
      throw new Error(`Model "${modelConfig.label}" has no visible bounds.`);
    }

    const baseScale = 2 / extent;
    return { model, center, scale: baseScale };
  }, [scene, modelConfig]);

  useLayoutEffect(() => {
    const restore: (() => void)[] = [];
    model.traverse((child) => {
      if (!(child instanceof Mesh)) return;

      const sourceMaterials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      const shouldAdjust = sourceMaterials.some(
        (material) =>
          (modelConfig.id === "saturn" && material.name === "rings") ||
          (modelConfig.material?.emissiveIntensity !== undefined &&
            material instanceof MeshStandardMaterial),
      );
      if (!shouldAdjust) return;

      const adjustedMaterials = sourceMaterials.map((source) => {
        const material = source.clone();
        if (modelConfig.id === "saturn" && material.name === "rings") {
          material.side = DoubleSide;
          material.transparent = true;
          material.depthWrite = false;
        }
        if (
          material instanceof MeshStandardMaterial &&
          modelConfig.material?.emissiveIntensity !== undefined
        ) {
          material.emissiveIntensity = modelConfig.material.emissiveIntensity;
        }
        return material;
      });

      const source = child.material;
      child.material = Array.isArray(source)
        ? adjustedMaterials
        : adjustedMaterials[0];
      restore.push(() => {
        child.material = source;
        adjustedMaterials.forEach((material) => material.dispose());
      });
    });
    return () => restore.forEach((dispose) => dispose());
  }, [model, modelConfig.id, modelConfig.material?.emissiveIntensity]);

  return (
    <group scale={scale} dispose={null}>
      <group position={[-center.x, -center.y, -center.z]}>
        <primitive object={model} />
      </group>
    </group>
  );
}

export default function PlanetModel({ modelConfig }: { modelConfig: SpaceModel }) {
  return modelConfig.id === "earth"
    ? <EarthPlanetModel />
    : <GenericPlanetModel modelConfig={modelConfig} />;
}
