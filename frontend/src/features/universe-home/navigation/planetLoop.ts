import type { PlanetId } from "../contracts";
import { PLANET_ORDER } from "./planetDestinations";

/** Circular index helpers for the planet loop.
 *
 * The destination list is treated as a ring: there is no first or last planet,
 * only a phase that keeps increasing or decreasing. Every wrap in the feature
 * goes through these functions, so "Saturn then Earth" is ordinary arithmetic
 * rather than a special case somebody has to remember to write. */

/** Positive modulo. `wrapIndex(-1, 3) === 2`. */
export function wrapIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

/** Folds a continuous phase into `[0, count)`.
 *
 * Because the orbit path is periodic in `count`, subtracting a whole number of
 * turns produces the identical transform for every planet. That is what lets
 * the loop run forever without float drift and without a visible reset. */
export function wrapPhase(phase: number, count: number): number {
  if (count <= 0 || !Number.isFinite(phase)) return 0;
  const wrapped = phase % count;
  return wrapped < 0 ? wrapped + count : wrapped;
}

/** Folds a slot offset into `(-count/2, count/2]`, i.e. the shortest way round. */
export function wrapOffset(offset: number, count: number): number {
  if (count <= 0) return 0;
  const half = count / 2;
  const wrapped = wrapPhase(offset + half, count) - half;
  // wrapPhase returns [0, count), so the fold lands on -half rather than +half
  // at the antipode. Both describe the same point; prefer the positive one so
  // `shortestStep` is deterministic instead of direction-dependent.
  return wrapped === -half ? half : wrapped;
}

/** Signed number of steps from one index to another, taking the short way. */
export function shortestStep(from: number, to: number, count: number): number {
  return wrapOffset(wrapIndex(to, count) - wrapIndex(from, count), count);
}

/** The destination resting at a (possibly unwrapped, possibly fractional) phase. */
export function planetIdAtPhase(phase: number): PlanetId {
  const count = PLANET_ORDER.length;
  return PLANET_ORDER[wrapIndex(Math.round(phase), count)];
}

/** Index of a destination in the configured order. */
export function planetIndex(id: PlanetId): number {
  const index = PLANET_ORDER.indexOf(id);
  if (index === -1) throw new Error(`Unknown planet "${id}" in PLANET_ORDER`);
  return index;
}
