"use client";

import { useCallback, useRef, useState } from "react";
import type {
  PhaseRef,
  PlanetId,
  StageRef,
  StageTargetRef,
  UniverseSceneHandle,
  UniverseStageId,
} from "../contracts";
import { PLANET_ORDER } from "./planetDestinations";
import {
  isSelectionStale,
  resolveSelection,
  retainSelection,
  type RecordedSelection,
} from "./homeSelection";

export type UniverseHomeState = {
  activePlanetId: PlanetId;
  selectedPlanetId: PlanetId | null;
  phase: PhaseRef;
  stage: StageRef;
  stageTarget: StageTargetRef;
  scene: UniverseSceneHandle | null;
  commitActivePlanet: (id: PlanetId) => void;
  selectPlanet: (id: PlanetId | null) => void;
  onSceneReady: (scene: UniverseSceneHandle | null) => void;
  onPlanetActivate: (id: PlanetId) => void;
  setPlanetActivateHandler: (handler: (id: PlanetId) => void) => () => void;
};

/** Home loop state for the persistent provider. This hook is provider
 * internals: it is called exactly once, by UniverseTransitionProvider, which
 * remains the single owner of active/selected/phase. Nothing else may hold an
 * active planet or a second copy of the loop position. */
export function useUniverseHomeState(pathname: string): UniverseHomeState {
  // The loop's continuous position lives in a ref, not state: it is written on
  // every animation frame and read inside useFrame, and it must survive route
  // changes and Canvas remounts so returning to Home restores the view. It is
  // deliberately separate from the legacy `homePosition` post playhead.
  const phase = useRef(0);
  // The home-to-destination blend and the destination it leads to. Same
  // reasoning as the phase, and likewise single cells: two copies would let the
  // scene and the route disagree about which composition is on screen.
  const stage = useRef(0);
  const stageTarget = useRef<UniverseStageId>("posts");
  const [activePlanetId, setActivePlanetId] = useState<PlanetId>(
    PLANET_ORDER[0],
  );
  const [selection, setSelection] = useState<RecordedSelection | null>(null);
  const [scene, setScene] = useState<UniverseSceneHandle | null>(null);

  // React learns the active planet once per move, when the timeline finishes
  // and the new destination is genuinely the one in focus. Nothing here runs
  // per frame, so a transition costs exactly one render.
  const commitActivePlanet = useCallback((id: PlanetId) => {
    setActivePlanetId((current) => (current === id ? current : id));
    // A recorded choice is stale once a different destination is active.
    setSelection((current) => retainSelection(current, id));
  }, []);

  const selectPlanet = useCallback(
    (id: PlanetId | null) => {
      // Recording a choice only. No route push, no zoom, no phase write and no
      // input lock: ordinary Next navigation stays in charge.
      setSelection(id === null ? null : { id, route: pathname });
    },
    [pathname],
  );

  const onSceneReady = useCallback((next: UniverseSceneHandle | null) => {
    setScene(next);
  }, []);

  // Clicks land inside the portalled Canvas, which the provider owns, but only
  // the homepage knows whether a click should focus a planet or open its
  // destination. A stable dispatcher keeps the memoized payload from
  // re-rendering every time that behaviour is re-created.
  const planetHandler = useRef<(id: PlanetId) => void>(() => {});
  const onPlanetActivate = useCallback((id: PlanetId) => {
    planetHandler.current(id);
  }, []);
  const setPlanetActivateHandler = useCallback(
    (handler: (id: PlanetId) => void) => {
      planetHandler.current = handler;
      return () => {
        if (planetHandler.current === handler) planetHandler.current = () => {};
      };
    },
    [],
  );

  // Drop the stored choice once navigation has settled elsewhere, rather than
  // only masking it: otherwise returning to the route it was made on would
  // resurrect a destination the user already opened. Adjusting state during
  // render is React's documented pattern for this and costs no extra commit.
  if (isSelectionStale(selection, pathname)) setSelection(null);
  const selectedPlanetId = resolveSelection(selection, pathname);

  return {
    activePlanetId,
    selectedPlanetId,
    phase,
    stage,
    stageTarget,
    scene,
    commitActivePlanet,
    selectPlanet,
    onSceneReady,
    onPlanetActivate,
    setPlanetActivateHandler,
  };
}
