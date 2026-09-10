import type { PlanetId } from "../contracts";

/** An explicit destination choice, stamped with the route it was made on. */
export type RecordedSelection = { id: PlanetId; route: string };

/** A choice belongs to the route it was made on, so it reads as cleared once
 * navigation has settled somewhere else. Deriving it this way avoids an effect
 * that would re-render the provider again after every route change.
 *
 * Masking alone is not clearing: pair this with `isSelectionStale` so the
 * stored value is actually dropped, or `/` -> `/groups` -> `/` matches the
 * original route again and resurrects a choice the user already acted on. */
export function resolveSelection(
  selection: RecordedSelection | null,
  pathname: string,
): PlanetId | null {
  if (!selection || selection.route !== pathname) return null;
  return selection.id;
}

/** True once navigation has settled on a different route than the one the
 * choice was recorded on, meaning the stored value should be discarded. */
export function isSelectionStale(
  selection: RecordedSelection | null,
  pathname: string,
): boolean {
  return selection !== null && selection.route !== pathname;
}

/** A recorded choice is stale once a different destination becomes active.
 * Returns the same reference when it should be kept, so React can bail out. */
export function retainSelection(
  selection: RecordedSelection | null,
  activeId: PlanetId,
): RecordedSelection | null {
  if (!selection || selection.id !== activeId) return null;
  return selection;
}
