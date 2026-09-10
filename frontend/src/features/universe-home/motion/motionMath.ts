/**
 * Pure motion math and layout calculations for Universe Home v1.
 * Owned by Agent 2 (GSAP / Motion Engineer).
 *
 * Implements the agreed contract:
 * x(i, p) = (p * (N - 1) - i) * S
 * where:
 *   N = number of configured planet destinations
 *   p = normalized rendered progress in [0, 1]
 *   i = destination index (0 = Earth, 1 = Mars, 2 = Saturn)
 *   S = measured world spacing between planet centers
 */

import type { PlanetId } from "../contracts";
import { PLANET_ORDER } from "../navigation/planetDestinations";

export { PLANET_ORDER };
export type { PlanetId };
export const DEFAULT_PLANET_ORDER = PLANET_ORDER;
export type DefaultPlanetId = PlanetId;

/**
 * Computes world X position for a destination rig's scrollRoot.
 * Positive X moves toward screen right.
 *
 * At p = 0: Earth at 0, Mars at -S, Saturn at -2S (Earth centered).
 * At p = 0.5: Earth at +S, Mars at 0, Saturn at -S (Mars centered).
 * At p = 1.0: Earth at +2S, Mars at +S, Saturn at 0 (Saturn centered).
 */
export function computeRigX(
  renderedProgress: number,
  destinationIndex: number,
  numDestinations: number,
  spacing: number,
): number {
  if (numDestinations <= 1) return 0;
  return (
    (renderedProgress * (numDestinations - 1) - destinationIndex) * spacing
  );
}

/**
 * Clamps progress strictly to [0, 1].
 */
export function clampProgress(progress: number): number {
  if (Number.isNaN(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}

/**
 * Derives the nearest configured snap stop i / (N - 1).
 * Avoids directional/velocity bias by computing the exact closest discrete stop.
 * Guarded against N <= 1 to avoid division by zero.
 */
export function getNearestStop(
  progress: number,
  numDestinations: number,
): number {
  if (numDestinations <= 1) return 0;
  const intervals = numDestinations - 1;
  const clamped = clampProgress(progress);
  return Math.round(clamped * intervals) / intervals;
}

/**
 * Derives the nearest destination index [0, N - 1] for a given progress.
 */
export function getNearestPlanetIndex(
  progress: number,
  numDestinations: number,
): number {
  if (numDestinations <= 1) return 0;
  const clamped = clampProgress(progress);
  const index = Math.round(clamped * (numDestinations - 1));
  return Math.max(0, Math.min(numDestinations - 1, index));
}

/**
 * Derives the exact progress stop [0, 1] for a given planet ID.
 * Returns 0 if planet not found or N <= 1.
 */
export function getStopForPlanet(
  planetId: string,
  planetOrder: readonly string[],
): number {
  const index = planetOrder.indexOf(planetId);
  if (index === -1 || planetOrder.length <= 1) return 0;
  return index / (planetOrder.length - 1);
}

/**
 * Calculates vertical scroll travel distance in pixels for the pin spacer.
 * Allocates a comfortable, bounded vertical distance per planet stop based on
 * the measured viewport height.
 */
export function computeTravelDistance(
  viewportHeight: number,
  numDestinations: number,
): number {
  if (numDestinations <= 1) return 0;
  const effectiveHeight = Math.max(400, viewportHeight);
  // Allocate ~1.0x viewport height (min 600px) per stop transition
  const travelPerStop = Math.max(600, Math.round(effectiveHeight * 1.0));
  return (numDestinations - 1) * travelPerStop;
}
