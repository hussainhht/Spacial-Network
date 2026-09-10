import type { Group } from "three";
import type { Ref } from "react";

/** Navigable destinations. The Moon is a satellite of the Earth rig, not a
 * destination, so it never appears in this union. */
export type PlanetId = "earth" | "mars" | "saturn";

/** One configured destination. UI strings and routes come from this record;
 * see `navigation/planetDestinations.ts`. */
export type PlanetDestination = {
  id: PlanetId;
  label: string;
  sectionLabel: string;
  href: string;
};

/** Per-destination transform roots. Each root has exactly one controller:
 * transitionRoot is reserved for a future route transition (identity in v1),
 * scrollRoot is written only by Agent 2's motion hook. */
export type PlanetRigHandle = {
  id: PlanetId;
  transitionRoot: Group;
  scrollRoot: Group;
};

export type UniverseSceneHandle = {
  rigs: ReadonlyMap<PlanetId, PlanetRigHandle>;
  // World units measured at z=0 using the current R3F camera/viewport.
  viewportWidth: number;
  viewportHeight: number;
  // Uniform center-to-center spacing; accounts for rings and Moon orbit.
  spacing: number;
  invalidate: () => void;
};

export type UniverseCanvasProps = {
  ref?: Ref<HTMLDivElement>;
  className?: string;
  renderActive: boolean;
  reducedMotion: boolean;
  onSceneReady: (scene: UniverseSceneHandle | null) => void;
};

export type HomeMotionController = {
  pause: () => void;
  resume: () => void;
  goToPlanet: (id: PlanetId) => void;
};

export type HomeMotionOptions = {
  root: HTMLElement | null;
  viewport: HTMLElement | null;
  scroller: HTMLElement | null;
  scene: UniverseSceneHandle | null;
  reducedMotion: boolean;
  enabled: boolean;
  progressRef: { current: number };
  onProgress: (normalizedProgress: number) => void;
};

/** The persistent provider is the only authority for these values. Do not
 * mirror activePlanetId, selectedPlanetId or normalized progress elsewhere. */
export type UniverseHomeAPI = {
  activePlanetId: PlanetId;
  selectedPlanetId: PlanetId | null;
  homeProgress: { current: number };
  scene: UniverseSceneHandle | null;
  reducedMotion: boolean;
  isTransitioning: boolean;
  reportHomeProgress: (progress: number) => void;
  selectPlanet: (id: PlanetId | null) => void;
};
