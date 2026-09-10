"use client";

import { useCallback, useRef, useState } from "react";
import type { PlanetId, UniverseSceneHandle } from "../contracts";
import { PLANET_ORDER } from "./planetDestinations";
import { clampProgress, progressToIndex } from "./homeProgress";
import {
  isSelectionStale,
  resolveSelection,
  retainSelection,
  type RecordedSelection,
} from "./homeSelection";

export type UniverseHomeState = {
  activePlanetId: PlanetId;
  selectedPlanetId: PlanetId | null;
  homeProgress: { current: number };
  scene: UniverseSceneHandle | null;
  reportHomeProgress: (progress: number) => void;
  selectPlanet: (id: PlanetId | null) => void;
  onSceneReady: (scene: UniverseSceneHandle | null) => void;
};

/** Home track state for the persistent provider. This hook is provider
 * internals: it is called exactly once, by UniverseTransitionProvider, which
 * remains the single owner of active/selected/progress. Nothing else may hold
 * an active planet or a normalized progress value. */
export function useUniverseHomeState(pathname: string): UniverseHomeState {
  // Continuous progress lives in a ref, not state: motion reports it on every
  // rendered tick, and it must survive route changes and Canvas remounts so a
  // return to Home can restore the previous position. It is deliberately
  // separate from the legacy `homePosition` post playhead.
  const homeProgress = useRef(0);
  const [activePlanetId, setActivePlanetId] = useState<PlanetId>(
    PLANET_ORDER[0],
  );
  const [selection, setSelection] = useState<RecordedSelection | null>(null);
  const [scene, setScene] = useState<UniverseSceneHandle | null>(null);

  const reportHomeProgress = useCallback((progress: number) => {
    const clamped = clampProgress(progress);
    homeProgress.current = clamped;
    const next = PLANET_ORDER[progressToIndex(clamped, PLANET_ORDER.length)];
    // Dispatching the derived id every tick is what keeps the label honest: an
    // index ref guarding this call could drift from the committed state (it did
    // on returning to Home) and then pinned the label to the wrong planet
    // permanently, because the guard suppressed the very update that would have
    // corrected it. Passing the current value back is free - React compares
    // eagerly and skips the render entirely - so a full scrub still costs one
    // render per index boundary, not one per frame.
    setActivePlanetId((current) => (current === next ? current : next));
    // A recorded choice is stale once a different destination is active.
    setSelection((current) => retainSelection(current, next));
  }, []);

  const selectPlanet = useCallback(
    (id: PlanetId | null) => {
      // Recording a choice only. No route push, no zoom, no progress write and
      // no input lock: ordinary Next navigation stays in charge.
      setSelection(id === null ? null : { id, route: pathname });
    },
    [pathname],
  );

  const onSceneReady = useCallback((next: UniverseSceneHandle | null) => {
    setScene(next);
  }, []);

  // Drop the stored choice once navigation has settled elsewhere, rather than
  // only masking it: otherwise returning to the route it was made on would
  // resurrect a destination the user already opened. Adjusting state during
  // render is React's documented pattern for this and costs no extra commit.
  if (isSelectionStale(selection, pathname)) setSelection(null);
  const selectedPlanetId = resolveSelection(selection, pathname);

  return {
    activePlanetId,
    selectedPlanetId,
    homeProgress,
    scene,
    reportHomeProgress,
    selectPlanet,
    onSceneReady,
  };
}
