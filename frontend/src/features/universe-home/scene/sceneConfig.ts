import { DEV_MODELS, type DevModel } from "@/components/space/modelsRegistry";
import type { PlanetId } from "../contracts";
import type { OrbitFraming } from "../motion/orbitPath";

function modelFor(id: string): DevModel {
  const model = DEV_MODELS.find((entry) => entry.id === id);
  if (!model) throw new Error(`Universe Home requires the canonical ${id} model.`);
  return model;
}

export const SCENE_MODELS = {
  earth: modelFor("earth"),
  moon: modelFor("moon"),
  mars: modelFor("mars"),
  saturn: modelFor("saturn"),
};

// A longer lens gives the large active body a restrained perspective. The
// camera never moves: only the planets travel, so there is exactly one
// coordinate system in motion at a time.
export const SCENE_CAMERA = {
  position: [0, 0, 18] as [number, number, number],
  fov: 30,
  near: 0.1,
  far: 120,
};
export const HARDWARE_DPR: [number, number] = [1, 1.5];
export const SOFTWARE_DPR = 0.5;
export const MAX_FRAME_DELTA = 0.05;

export const SPIN_SPEED: Record<PlanetId | "moon", number> = {
  earth: 0.035,
  moon: 0.018,
  mars: 0.03,
  saturn: 0.022,
};

export const EARTH_SYSTEM = {
  // EarthPlanetModel's visible surface radius after its existing normalization.
  // This display compensation leaves its geometry and shader shells untouched.
  modelScale: 1938.6019216974796 / 1221.1297423308124,
  atmosphereRadius: 1.025,
  moonRadius: 0.18,
  orbitRadius: 1.7,
  orbitSpeed: 0.026,
  orbitPhase: -0.55,
  orbitInclination: 0.32,
};

/** Below this emphasis the body is a distant neighbour rather than the subject,
 * and its satellite is a few pixels wide. Drawing the Moon's 180k triangles for
 * that is the one piece of geometry worth culling by hand. */
export const SATELLITE_EMPHASIS = 0.55;

/** Idle drift applied to the neighbours, as a fraction of the world half-height.
 * Small enough to read as "alive", far too small to compete with a transition. */
export const IDLE_DRIFT = 0.012;
export const IDLE_DRIFT_SPEED = 0.32;

/** Layout tiers, expressed as fractions of the measured world half-extents so
 * one set of numbers covers every viewport at a given breakpoint.
 *
 * `focusX` is where the active planet sits, `backX` the far side of the orbit;
 * together they fix the ellipse. `fitHeight` is the vertical room the active
 * body may occupy, leaving the heading and destination controls clear. */
type LayoutTier = {
  focusX: number;
  backX: number;
  yRadius: number;
  zRadius: number;
  scaleFar: number;
  fitWidth: number;
  fitHeight: number;
};

const DESKTOP: LayoutTier = {
  focusX: 0.34,
  backX: -0.62,
  yRadius: 0.66,
  zRadius: 4.5,
  scaleFar: 0.3,
  fitWidth: 0.92,
  fitHeight: 0.34,
};

// Narrower panes cannot afford the same lateral spread, so the orbit tightens
// and the active body gives up a little size to keep both neighbours in frame.
const TABLET: LayoutTier = {
  focusX: 0.24,
  backX: -0.54,
  yRadius: 0.62,
  zRadius: 4.2,
  scaleFar: 0.28,
  fitWidth: 0.9,
  fitHeight: 0.32,
};

// Portrait: the subject moves back towards the centre and the neighbours sit
// close in, well clear of the heading above and the destinations below.
const MOBILE: LayoutTier = {
  focusX: 0.08,
  backX: -0.46,
  yRadius: 0.55,
  zRadius: 3.9,
  scaleFar: 0.26,
  fitWidth: 0.86,
  fitHeight: 0.3,
};

export function layoutTier(pixelWidth: number): LayoutTier {
  if (pixelWidth >= 1024) return DESKTOP;
  if (pixelWidth >= 640) return TABLET;
  return MOBILE;
}

export type SceneFraming = {
  earthRadius: number;
  marsScale: number;
  saturnScale: number;
  orbit: OrbitFraming;
  /** World half-height, so per-frame drift can be sized without re-measuring. */
  halfHeight: number;
};

/** Fit a local envelope at z=0, allowing for its closest possible depth. */
function fitEnvelope(
  halfWidth: number,
  halfHeight: number,
  envelopeX: number,
  envelopeY: number,
  envelopeZ: number,
): number {
  const distance = SCENE_CAMERA.position[2];
  return Math.min(
    halfWidth / (envelopeX + (halfWidth * envelopeZ) / distance),
    halfHeight / (envelopeY + (halfHeight * envelopeZ) / distance),
  );
}

/**
 * Turns a measured R3F viewport into the ellipse the planets ride and the size
 * of each body. `worldWidth`/`worldHeight` are world units at z=0;
 * `pixelWidth` only picks the responsive tier.
 */
export function measureSceneFraming(
  worldWidth: number,
  worldHeight: number,
  pixelWidth: number,
): SceneFraming {
  const halfWidth = Math.max(0, worldWidth) / 2;
  const halfHeight = Math.max(0, worldHeight) / 2;
  const tier = layoutTier(pixelWidth);

  const focusX = tier.focusX * halfWidth;
  const backX = tier.backX * halfWidth;
  const orbit: OrbitFraming = {
    xCenter: (focusX + backX) / 2,
    xRadius: (focusX - backX) / 2,
    yCenter: 0,
    yRadius: tier.yRadius * halfHeight,
    // The focus sits on the z=0 plane the viewport was measured against, so the
    // active body is framed exactly as `fitEnvelope` assumes.
    zCenter: -tier.zRadius,
    zRadius: tier.zRadius,
    scaleNear: 1,
    scaleFar: tier.scaleFar,
  };

  // Room available to the active body around its own resting point.
  const fitWidth = (halfWidth - Math.abs(focusX)) * tier.fitWidth;
  const fitHeight = tier.fitHeight * halfHeight;
  const moonEnvelope = EARTH_SYSTEM.orbitRadius + EARTH_SYSTEM.moonRadius;
  const earthRadius = fitEnvelope(
    fitWidth, fitHeight, moonEnvelope,
    EARTH_SYSTEM.atmosphereRadius, moonEnvelope,
  );
  // Generic model normalization includes Saturn's full ring span. Conservative
  // radial margins cover axial rotation and the registry's static ring tilt.
  const marsScale = fitEnvelope(fitWidth, fitHeight, 1.05, 1.05, 1.05);
  const saturnScale = fitEnvelope(fitWidth, fitHeight, 1.1, 1.1, 1.1);

  return { earthRadius, marsScale, saturnScale, orbit, halfHeight };
}

export function sceneFrameloop(renderActive: boolean, reducedMotion: boolean) {
  if (!renderActive) return "never";
  return reducedMotion ? "demand" : "always";
}

export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|lavapipe/i.test(renderer);
}
