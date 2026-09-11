import type { Group } from "three";

/** Routes the persistent universe scene can dock into. Anything outside this
 * union navigates normally and never sees the shared scene. */
export type UniverseRoute = "/" | "/groups" | "/posts";

/** What the one transition coordinator is doing. A value other than an `idle-*`
 * one means a move owns the scene and no second move may start — this is the
 * flag that makes a double click on a planet a no-op. */
export type UniverseTransitionState =
  | "idle-home"
  | "idle-posts"
  | "idle-groups"
  | "home-to-posts"
  | "home-to-groups"
  | "posts-to-home"
  | "groups-to-home";

/** The moves, i.e. every non-idle state above. */
export type UniverseTransitionDirection = Exclude<
  UniverseTransitionState,
  `idle-${string}`
>;

export type EarthHandle = {
  group: Group;
  unitsPerPixel: () => number;
  motion: { speed: number };
};
export type SceneRegistration = {
  root: HTMLElement;
  pause: () => void;
  resume: () => void;
};
export type Point = { x: number; y: number };
