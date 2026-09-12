"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { AdditiveBlending, Box3, Group, Mesh, Vector3 } from "three";
import SceneErrorBoundary from "@/features/universe-home/scene/SceneErrorBoundary";
import { MAX_FRAME_DELTA, SUN, SUN_MODEL } from "../config/planets";
import { applySunMaterials, createGlowTexture } from "./sunMaterials";
import type { AssetErrorReporter } from "./PlanetModel";

/**
 * The star at the centre of the composition.
 *
 * It is drawn in three parts, weakest to strongest: a halo billboard, a Fresnel
 * limb on the export's own shell, and the plasma surface itself. Its light is
 * not here — that lives in `SolarLighting`, with the rest of the lighting, so
 * the whole exposure of the scene can be read in one file.
 */
export default function Sun({
  radius,
  animate,
  onAssetError,
}: {
  radius: number;
  animate: boolean;
  onAssetError: AssetErrorReporter;
}) {
  return (
    <group name="Sun">
      <SunGlow radius={radius} />
      <SceneErrorBoundary
        label={`Solar system: unable to load the Sun (${SUN_MODEL.path}).`}
        onError={() => onAssetError(SUN_MODEL)}
      >
        {/* The halo above renders immediately, so the star is present in the
            composition while its model is still downloading. */}
        <Suspense fallback={null}>
          <SunBody radius={radius} animate={animate} />
        </Suspense>
      </SceneErrorBoundary>
    </group>
  );
}

function SunBody({ radius, animate }: { radius: number; animate: boolean }) {
  const { scene } = useGLTF(SUN_MODEL.path);
  const spin = useRef<Group>(null);

  const { model, center, scale, meshes } = useMemo(() => {
    // Never the cached scene: its materials are about to be replaced.
    const model = scene.clone(true);
    const meshes: Mesh[] = [];
    let corona: Mesh | null = null;
    model.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      meshes.push(child);
      const material = child.material;
      if (
        !Array.isArray(material) &&
        "transmission" in material &&
        (material as { transmission: number }).transmission > 0
      ) {
        corona = child;
      }
    });

    const bounds = new Box3().setFromObject(model);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const extent = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(extent) || extent <= 0) {
      throw new Error("The Sun model has no visible bounds.");
    }
    // Measured before the shell is opened out, so `radius` stays the radius of
    // the visible disc rather than of the corona around it.
    const normalized = 2 / extent;
    if (corona) (corona as Mesh).scale.multiplyScalar(SUN.coronaScale);
    return { model, center, scale: normalized, meshes };
  }, [scene]);

  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    const restore = applySunMaterials(meshes);
    // As in `PlanetModel`: on demand, the star has to ask to be drawn.
    invalidate();
    return restore;
  }, [meshes, invalidate]);

  useFrame((_, delta) => {
    if (!animate || !spin.current) return;
    spin.current.rotation.y += Math.min(delta, MAX_FRAME_DELTA) * SUN.spinSpeed;
  });

  return (
    <group ref={spin} name="SunSpin" scale={radius}>
      <group scale={scale} dispose={null}>
        <group position={[-center.x, -center.y, -center.z]}>
          <primitive object={model} />
        </group>
      </group>
    </group>
  );
}

/** The halo. Drawn without a depth test and last, so it is one soft disc rather
 * than the annulus it would become where the star's own sphere clips it. */
function SunGlow({ radius }: { radius: number }) {
  const texture = useMemo(() => createGlowTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  const size = radius * SUN.glowScale * 2;

  return (
    <sprite name="SunGlow" scale={[size, size, 1]} renderOrder={2}>
      <spriteMaterial
        map={texture}
        blending={AdditiveBlending}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}
