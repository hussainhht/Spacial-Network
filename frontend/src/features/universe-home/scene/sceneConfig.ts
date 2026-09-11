import { DEV_MODELS, type DevModel } from "@/components/space/modelsRegistry";
import type { PlanetId } from "../contracts";
import type { OrbitFraming, OrbitPlacement } from "../motion/orbitPath";
import { groupsComposition } from "./groupsStage";
import { postsEarthAnchor } from "./postsStage";

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
  /** Where Earth rests on the Posts page, in the same rig-local units as an
   * orbit placement, so a transition is a plain interpolation between two
   * placements rather than a second coordinate system. */
  posts: OrbitPlacement;
  /** The Groups composition, in those same units: where Mars rests, and the
   * point the other bodies spiral into. */
  groups: { mars: OrbitPlacement; star: OrbitPlacement };
};

/** How far the neighbours retreat as the scene commits to Posts. Far enough to
 * read as leaving, near enough that returning home is not a rush back. */
export const NEIGHBOUR_RECEDE = 14;

/** Radians of orbit a body sweeps while it falls into the Groups core. Rather
 * more than a quarter turn, so the path reads as a spiral being drawn in rather
 * than as a straight line towards the middle. */
export const ABSORB_SWEEP = Math.PI * 1.35;

/** Each body starts its dive a little after the one before it. The Moon leads
 * because it is already inside Earth's rig and closest to the core's pull; the
 * subject of the composition never dives at all. */
export const ABSORB_DELAY: Record<PlanetId | "moon", number> = {
  moon: 0,
  saturn: 0.06,
  earth: 0.14,
  mars: 0,
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
 * `pixelWidth`/`pixelHeight` pick the responsive tier and convert the Posts
 * anchor, which is authored in pixels, into the same world units.
 */
export function measureSceneFraming(
  worldWidth: number,
  worldHeight: number,
  pixelWidth: number,
  pixelHeight: number,
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

  // The Posts composition is fixed by one anchor expressed in pixels, so the
  // scene and the DOM feed agree on Earth's centre without measuring each other.
  const anchor = postsEarthAnchor(pixelWidth, pixelHeight);
  const unitsPerPixel = worldWidth / Math.max(1, pixelWidth);
  const postsRadius = (anchor.diameter / 2) * unitsPerPixel;
  const posts: OrbitPlacement = {
    x: (anchor.x * unitsPerPixel) - halfWidth,
    y: halfHeight - anchor.y * unitsPerPixel,
    z: 0,
    // `orbitRoot.scale` multiplies EarthSystem's own `earthRadius`, so the
    // target is a ratio rather than a size. A degenerate measurement leaves the
    // planet where it is instead of collapsing it.
    scale: earthRadius > 0 ? postsRadius / earthRadius : 1,
  };

  // The Groups composition is fixed the same way, from one shared anchor set.
  const composition = groupsComposition(pixelWidth, pixelHeight);
  const toWorld = (x: number, y: number) => ({
    x: x * unitsPerPixel - halfWidth,
    y: halfHeight - y * unitsPerPixel,
  });
  const marsRadius = (composition.mars.diameter / 2) * unitsPerPixel;
  const marsAnchor = toWorld(composition.mars.x, composition.mars.y);
  const starAnchor = toWorld(composition.star.x, composition.star.y);
  const groups = {
    mars: {
      ...marsAnchor,
      z: 0,
      // `orbitRoot.scale` multiplies the rig's own `marsScale`, so this is a
      // ratio rather than a size — as with `posts` above.
      scale: marsScale > 0 ? marsRadius / marsScale : 1,
    },
    // A target, not a body: the bodies that reach it have already collapsed.
    star: { ...starAnchor, z: 0, scale: 0 },
  };

  return {
    earthRadius, marsScale, saturnScale, orbit, halfHeight, posts, groups,
  };
}

export function sceneFrameloop(renderActive: boolean, reducedMotion: boolean) {
  if (!renderActive) return "never";
  return reducedMotion ? "demand" : "always";
}

export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|lavapipe/i.test(renderer);
}
