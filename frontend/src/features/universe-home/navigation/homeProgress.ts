import type { PlanetId } from "../contracts";
import { PLANET_ORDER } from "./planetDestinations";

/** Normalized track progress is always in [0,1]. Non-finite input (an
 * unmeasured trigger, a division by a zero-height spacer) resolves to 0 rather
 * than poisoning the stored ref. */
export function clampProgress(progress: number): number {
  // NaN (an unmeasured trigger, a division by a zero-height spacer) resolves to
  // the start rather than poisoning the stored ref. The comparisons below
  // already carry -Infinity to 0 and Infinity to 1.
  if (Number.isNaN(progress)) return 0;
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  return progress;
}

/** Nearest destination index for a normalized progress value. This is the only
 * definition of "which planet is active"; the index is derived on demand and is
 * never stored as a second piece of state. Guards N <= 1. */
export function progressToIndex(progress: number, count: number): number {
  if (count <= 1) return 0;
  return Math.round(clampProgress(progress) * (count - 1));
}

/** Normalized snap stop for a destination index, matching the contract's
 * `i / (N - 1)` resting positions. */
export function indexToProgress(index: number, count: number): number {
  if (count <= 1) return 0;
  const bounded = Math.min(Math.max(index, 0), count - 1);
  return bounded / (count - 1);
}

export function planetIdAtProgress(progress: number): PlanetId {
  return PLANET_ORDER[progressToIndex(progress, PLANET_ORDER.length)];
}
