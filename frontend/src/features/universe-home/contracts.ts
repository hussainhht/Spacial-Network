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

/** A mutable phase cell. The loop's continuous position lives in one of these
 * rather than in React state: it is written on every animation frame and read
 * inside `useFrame`, and neither may cost a render. */
export type PhaseRef = { current: number };

/** Per-destination transform roots. Each root has exactly one controller:
 * `transitionRoot` is reserved for a future route transition (identity today),
 * `orbitRoot` is written only by the rig's own frame loop. */
export type PlanetRigHandle = {
  id: PlanetId;
  transitionRoot: Group;
  orbitRoot: Group;
};

/** Published once the renderer is live. It deliberately carries no measurements:
 * republishing on resize used to tear down and rebuild the whole motion layer,
 * which was one of the sources of the scroll stutter. Sizing is internal to the
 * scene now, and this handle only answers "is there something to drive?". */
export type UniverseSceneHandle = {
  invalidate: () => void;
};

export type UniverseCanvasProps = {
  ref?: Ref<HTMLDivElement>;
  className?: string;
  renderActive: boolean;
  reducedMotion: boolean;
  /** Continuous loop position, owned by the motion controller. */
  phase: PhaseRef;
  onSceneReady: (scene: UniverseSceneHandle | null) => void;
  /** A planet was clicked. Focusing versus opening is decided by the homepage. */
  onPlanetActivate: (id: PlanetId) => void;
};

export type HomeMotionController = {
  pause: () => void;
  resume: () => void;
  /** Animates to a destination the short way round the loop. */
  goToPlanet: (id: PlanetId) => void;
  /** Advances one destination: +1 forward, -1 backward. */
  step: (direction: 1 | -1) => void;
};

export type HomeMotionOptions = {
  /** Gesture surface. Wheel, touch and key input are bound here, once. */
  root: HTMLElement | null;
  phase: PhaseRef;
  scene: UniverseSceneHandle | null;
  reducedMotion: boolean;
  enabled: boolean;
  /** Called when a move finishes and the new destination becomes official. */
  onCommit: (id: PlanetId) => void;
};

/** The persistent provider is the only authority for these values. Do not
 * mirror activePlanetId, selectedPlanetId or the loop phase elsewhere. */
export type UniverseHomeAPI = {
  activePlanetId: PlanetId;
  selectedPlanetId: PlanetId | null;
  phase: PhaseRef;
  scene: UniverseSceneHandle | null;
  reducedMotion: boolean;
  isTransitioning: boolean;
  commitActivePlanet: (id: PlanetId) => void;
  selectPlanet: (id: PlanetId | null) => void;
  /** Installs the handler for clicks on a planet in the scene. The provider
   * portals the Canvas, so it holds the only stable channel to it; the homepage
   * supplies the behaviour because only it knows how to focus and to route. */
  setPlanetActivateHandler: (handler: (id: PlanetId) => void) => () => void;
};
