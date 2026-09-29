export type PlanetId =
  | "earth"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "sun"
  | "black-hole";

export type CompanionId = "moon";
export type SceneVector = readonly [number, number, number];
export type PlanetViewport = "desktop" | "tablet" | "mobile";

export interface SpaceModel {
  id: PlanetId | CompanionId;
  label: string;
  modelPath: string;
  material?: {
    emissiveIntensity?: number;
  };
}

export interface PlanetTheme {
  accent: string;
  accentHover: string;
  accentActive: string;
  accentSoft: string;
  border: string;
  borderStrong: string;
  glow: string;
  surfaceTint: string;
  focusRing: string;
}

export interface ResponsiveComposition {
  scaleMultiplier: number;
  positionOffset: SceneVector;
}

export interface PlanetConfig extends SpaceModel {
  id: PlanetId;
  companion: CompanionId | null;
  scene: {
    bodyScale: number;
    position: SceneVector;
    rotation: SceneVector;
    offscreenRadius: number;
    spinRadiansPerSecond: number;
    idleAmplitude: number;
    responsive: Record<PlanetViewport, ResponsiveComposition>;
  };
  lighting: {
    ambientIntensity: number;
    directionalIntensity: number;
  };
  theme: PlanetTheme;
}

export const DEFAULT_PLANET_ID: PlanetId = "earth";
export const EARTH_MODEL_PATH = "/models/planets/earth-final.glb";

const EARTH_THEME: PlanetTheme = {
  accent: "#69aef0",
  accentHover: "#86c3f7",
  accentActive: "#285f96",
  accentSoft: "rgba(82, 157, 224, 0.1)",
  border: "rgba(103, 178, 239, 0.18)",
  borderStrong: "rgba(103, 178, 239, 0.34)",
  glow: "rgba(66, 145, 218, 0.14)",
  surfaceTint: "rgba(50, 114, 178, 0.045)",
  focusRing: "#78b6ef",
};

const BLACK_HOLE_THEME: PlanetTheme = {
  accent: "#9a86f2",
  accentHover: "#bcaefb",
  accentActive: "#4a3792",
  accentSoft: "rgba(154, 134, 242, 0.1)",
  border: "rgba(154, 134, 242, 0.18)",
  borderStrong: "rgba(188, 174, 251, 0.34)",
  glow: "rgba(122, 96, 224, 0.16)",
  surfaceTint: "rgba(122, 96, 224, 0.045)",
  focusRing: "#b09ff8",
};

export const PLANET_REGISTRY: Record<PlanetId, PlanetConfig> = {
  earth: {
    id: "earth",
    label: "Earth",
    modelPath: EARTH_MODEL_PATH,
    companion: "moon",
    scene: {
      bodyScale: 2.2,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      offscreenRadius: 3.2,
      spinRadiansPerSecond: 0.018,
      idleAmplitude: 0.012,
      responsive: {
        desktop: { scaleMultiplier: 1, positionOffset: [0, 0, 0] },
        tablet: { scaleMultiplier: 0.94, positionOffset: [-0.02, 0, 0] },
        mobile: { scaleMultiplier: 0.84, positionOffset: [-0.08, 0.02, 0] },
      },
    },
    lighting: { ambientIntensity: 0.12, directionalIntensity: 3 },
    theme: EARTH_THEME,
  },
  mercury: {
    id: "mercury",
    label: "Mercury",
    modelPath: "/models/planets/mercury-final.glb",
    companion: null,
    scene: {
      bodyScale: 1.48,
      position: [0, 0.01, 0],
      rotation: [0.03, -0.18, -0.02],
      offscreenRadius: 1.5,
      spinRadiansPerSecond: 0.014,
      idleAmplitude: 0.01,
      responsive: {
        desktop: { scaleMultiplier: 1, positionOffset: [0, 0, 0] },
        tablet: { scaleMultiplier: 0.96, positionOffset: [0, 0, 0] },
        mobile: { scaleMultiplier: 0.88, positionOffset: [-0.04, 0.02, 0] },
      },
    },
    lighting: { ambientIntensity: 0.14, directionalIntensity: 3.1 },
    theme: {
      accent: "#b7c0ca",
      accentHover: "#d7dde4",
      accentActive: "#59636f",
      accentSoft: "rgba(183, 192, 202, 0.085)",
      border: "rgba(183, 192, 202, 0.17)",
      borderStrong: "rgba(203, 213, 225, 0.31)",
      glow: "rgba(183, 192, 202, 0.11)",
      surfaceTint: "rgba(183, 192, 202, 0.035)",
      focusRing: "#cbd5e1",
    },
  },
  venus: {
    id: "venus",
    label: "Venus",
    modelPath: "/models/planets/venus-final.glb",
    companion: null,
    scene: {
      bodyScale: 1.38,
      position: [0, 0, 0],
      rotation: [0.04, 0.14, -0.04],
      offscreenRadius: 1.4,
      spinRadiansPerSecond: 0.012,
      idleAmplitude: 0.011,
      responsive: {
        desktop: { scaleMultiplier: 1, positionOffset: [0, 0, 0] },
        tablet: { scaleMultiplier: 0.94, positionOffset: [0, 0, 0] },
        mobile: { scaleMultiplier: 0.84, positionOffset: [-0.05, 0.01, 0] },
      },
    },
    lighting: { ambientIntensity: 0.13, directionalIntensity: 2.8 },
    theme: {
      accent: "#dfb46a",
      accentHover: "#f0cd8c",
      accentActive: "#876126",
      accentSoft: "rgba(223, 180, 106, 0.09)",
      border: "rgba(223, 180, 106, 0.18)",
      borderStrong: "rgba(240, 205, 140, 0.31)",
      glow: "rgba(202, 145, 57, 0.12)",
      surfaceTint: "rgba(223, 180, 106, 0.038)",
      focusRing: "#e8c17e",
    },
  },
  mars: {
    id: "mars",
    label: "Mars",
    modelPath: "/models/planets/mars-final.glb",
    companion: null,
    scene: {
      bodyScale: 1.42,
      position: [0, 0.01, 0],
      rotation: [0.05, -0.18, -0.08],
      offscreenRadius: 1.44,
      spinRadiansPerSecond: 0.02,
      idleAmplitude: 0.011,
      responsive: {
        desktop: { scaleMultiplier: 1, positionOffset: [0, 0, 0] },
        tablet: { scaleMultiplier: 0.94, positionOffset: [0, 0, 0] },
        mobile: { scaleMultiplier: 0.85, positionOffset: [-0.05, 0.02, 0] },
      },
    },
    lighting: { ambientIntensity: 0.12, directionalIntensity: 3 },
    theme: {
      accent: "#d8794e",
      accentHover: "#ed9a72",
      accentActive: "#883e26",
      accentSoft: "rgba(216, 121, 78, 0.09)",
      border: "rgba(216, 121, 78, 0.18)",
      borderStrong: "rgba(237, 154, 114, 0.31)",
      glow: "rgba(196, 76, 35, 0.12)",
      surfaceTint: "rgba(216, 121, 78, 0.04)",
      focusRing: "#e58b63",
    },
  },
  jupiter: {
    id: "jupiter",
    label: "Jupiter",
    modelPath: "/models/planets/jupiter-final.glb",
    companion: null,
    material: { emissiveIntensity: 0.24 },
    scene: {
      bodyScale: 1.23,
      position: [0, 0.02, 0],
      rotation: [0.04, 0.12, -0.05],
      offscreenRadius: 1.25,
      spinRadiansPerSecond: 0.026,
      idleAmplitude: 0.009,
      responsive: {
        desktop: { scaleMultiplier: 1, positionOffset: [0, 0, 0] },
        tablet: { scaleMultiplier: 0.91, positionOffset: [-0.02, 0, 0] },
        mobile: { scaleMultiplier: 0.78, positionOffset: [-0.08, 0.03, 0] },
      },
    },
    lighting: { ambientIntensity: 0.1, directionalIntensity: 2.6 },
    theme: {
      accent: "#c7a27c",
      accentHover: "#dec19f",
      accentActive: "#755334",
      accentSoft: "rgba(199, 162, 124, 0.085)",
      border: "rgba(199, 162, 124, 0.17)",
      borderStrong: "rgba(222, 193, 159, 0.3)",
      glow: "rgba(181, 128, 76, 0.11)",
      surfaceTint: "rgba(199, 162, 124, 0.036)",
      focusRing: "#d1b18e",
    },
  },
  saturn: {
    id: "saturn",
    label: "Saturn",
    modelPath: "/models/planets/saturn-final.glb",
    companion: null,
    scene: {
      bodyScale: 1.54,
      position: [0, 0.01, 0],
      rotation: [0.32, 0.18, 0.08],
      offscreenRadius: 1.58,
      spinRadiansPerSecond: 0.022,
      idleAmplitude: 0.009,
      responsive: {
        desktop: { scaleMultiplier: 1, positionOffset: [0, 0, 0] },
        tablet: { scaleMultiplier: 0.88, positionOffset: [-0.03, 0, 0] },
        mobile: { scaleMultiplier: 0.72, positionOffset: [-0.1, 0.03, 0] },
      },
    },
    lighting: { ambientIntensity: 0.14, directionalIntensity: 2.9 },
    theme: {
      accent: "#d8c188",
      accentHover: "#ead9aa",
      accentActive: "#7b6735",
      accentSoft: "rgba(216, 193, 136, 0.085)",
      border: "rgba(216, 193, 136, 0.18)",
      borderStrong: "rgba(234, 217, 170, 0.31)",
      glow: "rgba(196, 166, 92, 0.11)",
      surfaceTint: "rgba(216, 193, 136, 0.036)",
      focusRing: "#dfca96",
    },
  },
  uranus: {
    id: "uranus",
    label: "Uranus",
    modelPath: "/models/planets/uranus-final.glb",
    companion: null,
    scene: {
      bodyScale: 1.34,
      position: [0, 0.01, 0],
      rotation: [0.1, 0.12, 1.7],
      offscreenRadius: 1.38,
      spinRadiansPerSecond: 0.016,
      idleAmplitude: 0.01,
      responsive: {
        desktop: { scaleMultiplier: 1, positionOffset: [0, 0, 0] },
        tablet: { scaleMultiplier: 0.91, positionOffset: [-0.02, 0, 0] },
        mobile: { scaleMultiplier: 0.78, positionOffset: [-0.08, 0.03, 0] },
      },
    },
    lighting: { ambientIntensity: 0.14, directionalIntensity: 2.65 },
    theme: {
      accent: "#6fcfd3",
      accentHover: "#99e3e4",
      accentActive: "#287780",
      accentSoft: "rgba(111, 207, 211, 0.085)",
      border: "rgba(111, 207, 211, 0.17)",
      borderStrong: "rgba(153, 227, 228, 0.3)",
      glow: "rgba(76, 185, 192, 0.11)",
      surfaceTint: "rgba(111, 207, 211, 0.035)",
      focusRing: "#82dadd",
    },
  },
  sun: {
    id: "sun",
    label: "Sun",
    modelPath: "/models/planets/sun-final.glb",
    companion: null,
    material: { emissiveIntensity: 0.34 },
    scene: {
      bodyScale: 1.2,
      position: [0, 0.02, 0],
      rotation: [0.03, -0.12, 0],
      offscreenRadius: 1.22,
      spinRadiansPerSecond: 0.01,
      idleAmplitude: 0.008,
      responsive: {
        desktop: { scaleMultiplier: 1, positionOffset: [0, 0, 0] },
        tablet: { scaleMultiplier: 0.9, positionOffset: [-0.02, 0, 0] },
        mobile: { scaleMultiplier: 0.76, positionOffset: [-0.09, 0.03, 0] },
      },
    },
    lighting: { ambientIntensity: 0.06, directionalIntensity: 0.75 },
    theme: {
      accent: "#e5a13c",
      accentHover: "#f2bd65",
      accentActive: "#925713",
      accentSoft: "rgba(229, 161, 60, 0.09)",
      border: "rgba(229, 161, 60, 0.18)",
      borderStrong: "rgba(242, 189, 101, 0.31)",
      glow: "rgba(222, 139, 33, 0.12)",
      surfaceTint: "rgba(229, 161, 60, 0.038)",
      focusRing: "#edb252",
    },
  },
  // Premium selectable model: intentionally heavier than the other bodies
  // (see /3d/optimize-black-hole-premium.sh — 372k tris / 17MB vs. the
  // lightweight tier's 13k tris / 1.7MB) and scaled up to read as a
  // dominant, cinematic centerpiece rather than a background body. Kept at
  // position z 0 like every other planet — CANVAS_SCALE's back-off math in
  // PlanetBackground.tsx only compensates apparent size for bodies at z 0,
  // so a bigger look comes from bodyScale alone rather than pulling the
  // body toward the camera, which is why offscreenRadius/responsive
  // offsets are tuned separately from the other planets instead of reusing
  // their proportions.
  "black-hole": {
    id: "black-hole",
    label: "Black Hole",
    modelPath: "/models/planets/black-hole-premium.glb",
    companion: null,
    scene: {
      bodyScale: 2.6,
      position: [-0.55, 0, 0],
      rotation: [0.44, 0.32, 0.04],
      offscreenRadius: 2.7,
      spinRadiansPerSecond: 0.012,
      idleAmplitude: 0.011,
      responsive: {
        desktop: { scaleMultiplier: 1, positionOffset: [0, 0, 0] },
        tablet: { scaleMultiplier: 0.84, positionOffset: [-0.04, 0, 0] },
        mobile: { scaleMultiplier: 0.66, positionOffset: [-0.11, 0.02, 0] },
      },
    },
    lighting: { ambientIntensity: 0.06, directionalIntensity: 3 },
    theme: BLACK_HOLE_THEME,
  },
};

export const SELECTABLE_PLANETS: readonly PlanetConfig[] = [
  PLANET_REGISTRY.earth,
  PLANET_REGISTRY.mercury,
  PLANET_REGISTRY.venus,
  PLANET_REGISTRY.mars,
  PLANET_REGISTRY.jupiter,
  PLANET_REGISTRY.saturn,
  PLANET_REGISTRY.uranus,
  PLANET_REGISTRY.sun,
  PLANET_REGISTRY["black-hole"],
];

export const MOON_MODEL: SpaceModel = {
  id: "moon",
  label: "Moon",
  modelPath: "/models/planets/moon-final.glb",
};

export const MOON_COMPANION = {
  model: MOON_MODEL,
  orbitRadius: 2.75,
  orbitRadiansPerSecond: 0.042,
  scale: 0.18,
  initialPhase: -2.85,
  inclination: 0.3,
  planeRotation: -0.12,
} as const;

export function isPlanetId(value: unknown): value is PlanetId {
  return typeof value === "string" && value in PLANET_REGISTRY;
}

export function getPlanetConfig(value: unknown): PlanetConfig {
  return isPlanetId(value)
    ? PLANET_REGISTRY[value]
    : PLANET_REGISTRY[DEFAULT_PLANET_ID];
}
