import type { Group } from "three";

/** Routes the persistent universe scene can dock into. Anything outside this
 * union navigates normally and never sees the shared Earth. */
export type UniverseRoute = "/" | "/groups" | "/posts";

export type UniverseTransitionState =
  | "idle-home"
  | "home-to-groups"
  | "idle-groups"
  | "groups-to-home"
  | "home-to-posts"
  | "idle-posts";
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
