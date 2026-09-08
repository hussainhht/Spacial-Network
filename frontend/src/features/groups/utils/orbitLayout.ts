import type { Group } from "../types/group";

export const ORBITS = [
  { radius: 21, duration: 100, direction: 1 },
  { radius: 32, duration: 140, direction: -1 },
  { radius: 43, duration: 180, direction: 1 },
] as const;

export type OrbitPosition = { group: Group; ring: number; angle: number };

/** Stable ID order and evenly spaced slots keep each batch legible and repeatable. */
export function createOrbitLayout(groups: Group[]): OrbitPosition[] {
  const sorted = [...groups].sort((a, b) => a.id - b.id);
  return sorted.map((group, index) => {
    const ring = index % ORBITS.length;
    const count = Math.ceil((sorted.length - ring) / ORBITS.length);
    return {
      group,
      ring,
      angle: (Math.floor(index / ORBITS.length) / count) * 360 - 75 + ring * 37,
    };
  });
}
