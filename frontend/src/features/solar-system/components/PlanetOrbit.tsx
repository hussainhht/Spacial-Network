"use client";

import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, LineBasicMaterial } from "three";
import { PLANETS } from "../config/planets";

const SEGMENTS = 192;
/** Neutral slate, never a tint. The rings are there to explain the geometry of
 * the system, and a coloured line would read as a UI element. */
const RING_RGB = [0.62, 0.68, 0.78] as const;

/**
 * The orbit rings.
 *
 * One material for all of them, and the brightness variation baked into vertex
 * colours instead: the near side of a ring is brighter than the far side, so
 * each ellipse comes forward out of the dark rather than sitting on it as a flat
 * outline. That costs nothing per frame — the camera does not move, so the
 * gradient is correct for as long as the ring exists.
 */
export default function PlanetOrbit({ spread }: { spread: number }) {
  const material = useMemo(
    () =>
      new LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.24,
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

  return (
    <group name="OrbitRings">
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
    // The camera looks along -Z from above, so +Z is the near side of the ring.
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
