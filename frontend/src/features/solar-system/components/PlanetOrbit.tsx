"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  type Group,
  type LineLoop,
} from "three";
import { PLANETS } from "../config/planets";
import { bodyFocus, type CameraRig } from "../navigation/cameraPose";

const SEGMENTS = 192;
/** Neutral slate, never a tint. The rings are there to explain the geometry of
 * the system, and a coloured line would read as a UI element. */
const RING_RGB = [0.62, 0.68, 0.78] as const;
const RING_OPACITY = 0.24;
/** How much of their opacity the rings give up when the camera is at a body.
 * Up close a ring is no longer a map of the system, it is a line through the
 * planet and across the page, so it recedes — but it stays, faintly, as the
 * path the planet is on. */
const FOCUSED_FADE = 0.72;

/**
 * The orbit rings.
 *
 * One material for all of them, and the brightness variation baked into vertex
 * colours instead: the near side of a ring is brighter than the far side, so
 * each ellipse comes forward out of the dark rather than sitting on it as a flat
 * outline. That costs nothing per frame, and it is authored for the Home
 * viewpoint, which is the only one the rings are drawn at full strength from.
 */
export default function PlanetOrbit({
  spread,
  rigRef,
}: {
  spread: number;
  rigRef: RefObject<CameraRig>;
}) {
  const rings = useRef<Group>(null);
  const material = useMemo(
    () =>
      new LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: RING_OPACITY,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  const geometries = useMemo(
    () =>
      PLANETS.map((planet) => ({
        id: planet.id,
        geometry: ringGeometry(planet.orbitRadius * spread),
      })),
    [spread],
  );
  useEffect(
    () => () => {
      for (const { geometry } of geometries) geometry.dispose();
    },
    [geometries],
  );

  useFrame(() => {
    // Every ring shares one material, so the first one speaks for all of them.
    const ring = rings.current?.children[0] as LineLoop | undefined;
    if (!ring) return;
    (ring.material as LineBasicMaterial).opacity =
      RING_OPACITY * (1 - FOCUSED_FADE * bodyFocus(rigRef.current));
  });

  return (
    <group ref={rings} name="OrbitRings">
      {geometries.map(({ id, geometry }) => (
        <lineLoop
          key={id}
          name={`${id}-Ring`}
          geometry={geometry}
          material={material}
        />
      ))}
    </group>
  );
}

function ringGeometry(radius: number): BufferGeometry {
  const positions = new Float32Array(SEGMENTS * 3);
  const colors = new Float32Array(SEGMENTS * 3);
  for (let index = 0; index < SEGMENTS; index += 1) {
    const angle = (index / SEGMENTS) * Math.PI * 2;
    // Matches `orbitPosition`: a planet must sit exactly on its own ring.
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 2] = -Math.sin(angle) * radius;
    // The Home camera looks along -Z from above, so +Z is the near side of the
    // ring.
    const nearness = (1 - Math.sin(angle)) / 2;
    const brightness = 0.28 + 0.72 * Math.pow(nearness, 1.2);
    colors[index * 3] = RING_RGB[0] * brightness;
    colors[index * 3 + 1] = RING_RGB[1] * brightness;
    colors[index * 3 + 2] = RING_RGB[2] * brightness;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}
