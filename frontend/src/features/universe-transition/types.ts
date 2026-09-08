import type { Group } from "three";
export type UniverseTransitionState =
  "idle-home" | "home-to-groups" | "idle-groups" | "groups-to-home";
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
