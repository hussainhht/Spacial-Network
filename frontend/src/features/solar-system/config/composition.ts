import { MOON, PLANETS, SUN, type PlanetConfig } from "./planets";

/**
 * Camera framing for the home scene.
 *
 * The camera never moves during a session: the composition in `planets.ts` was
 * authored against one viewpoint, and travelling it is the next phase's job.
 * What does change is the viewport, so this module turns a measured pane into
 * the one camera that frames the same composition inside it.
 *
 * The camera looks along -Z from above the orbital plane, which is why every
 * ring reads as an ellipse and why a planet on the far side of its orbit sits
 * higher in frame and smaller than one on the near side. That single tilt is
 * what gives the scene its depth; a head-on camera would flatten it into a row
 * of discs no matter where the planets were placed.
 */
export type CameraTier = {
  fov: number;
  /** Degrees above the orbital plane. Shallow reads cinematic; steeper reads as
   * a map, which is what a tall pane needs to use its height. */
  elevation: number;
  /** The point the camera looks at, on the plane. Offsetting it from the Sun is
   * what puts the star in the lower left and opens the frame to its right. */
  target: readonly [number, number, number];
  /** Authored distance: the framing this composition was designed at. Fitting
   * may push the camera back, never pull it in, so a wide pane always gets the
   * intended shot. */
  distance: number;
  /** Orbit radii multiplier. Narrow panes draw the system in rather than
   * shrinking it away.
   *
   * This is the only lever a narrow pane needs, and deliberately the only one:
   * enlarging the bodies as well achieves nothing, because the framing is set by
   * the widest of them, so the camera simply retreats by as much as they grew. */
  spread: number;
};

const WIDE: CameraTier = {
  fov: 30,
  elevation: 25,
  target: [6, 0, -7],
  distance: 42,
  spread: 1,
};

// A squarer pane has less room sideways and more above, so the camera climbs
// and the system tightens a little.
const BALANCED: CameraTier = {
  fov: 33,
  elevation: 34,
  target: [4.5, 0, -6],
  distance: 42,
  spread: 0.92,
};

// Portrait. The orbits are drawn well in and the camera climbs towards a map
// view, which is the only angle where a tall frame can hold the outer rings.
const TALL: CameraTier = {
  fov: 38,
  elevation: 45,
  target: [2.5, 0, -4],
  distance: 40,
  spread: 0.74,
};

// A phone held upright. No camera angle makes a roughly square layout fill a
// 9:19 frame, so the orbits are drawn right in and the camera goes nearly
// overhead: the pane keeps a legible solar system rather than a faithful one,
// with the sky it cannot fill above and below it.
const NARROW: CameraTier = {
  fov: 40,
  elevation: 50,
  target: [1.8, 0, -3],
  distance: 34,
  spread: 0.58,
};

export function cameraTier(aspect: number): CameraTier {
  if (aspect >= 1.45) return WIDE;
  if (aspect >= 0.95) return BALANCED;
  if (aspect >= 0.66) return TALL;
  return NARROW;
}

/** Clear space reserved at each edge, in NDC. The bottom keeps the planet dock
 * from ever sitting on a body, and the top does the same for the title. */
const MARGIN = { x: 0.04, top: 0.1, bottom: 0.2 };

export type SolarFraming = {
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
  /** Orbit radius multiplier, applied to every ring and every planet together
   * so a body can never leave its own ring. */
  spread: number;
};

/** A body reduced to what framing cares about: where it is, and how far it
 * reaches across and up the screen. The two differ for the Earth system, whose
 * satellite swings much further sideways than it ever rises. */
type Extent = { x: number; z: number; radiusX: number; radiusY: number };

function extents(tier: CameraTier): Extent[] {
  const corona = SUN.radius * SUN.coronaScale;
  const list: Extent[] = [{ x: 0, z: 0, radiusX: corona, radiusY: corona }];
  // The Moon's orbit lies very nearly in the ecliptic, so on screen it is an
  // ellipse: the full radius sideways, and that radius foreshortened by the
  // camera's tilt vertically. Framing Earth as a circle of its satellite's full
  // reach would push the camera back for clearance that is never used.
  const foreshorten = Math.sin((tier.elevation * Math.PI) / 180);
  for (const planet of PLANETS) {
    const angle = (planet.orbitAngle * Math.PI) / 180;
    const orbit = planet.orbitRadius * tier.spread;
    const satellite = planet.id === "earth";
    list.push({
      x: Math.cos(angle) * orbit,
      z: -Math.sin(angle) * orbit,
      radiusX: satellite
        ? planet.radius * (MOON.orbitRadius + MOON.radius)
        : planet.radius,
      radiusY: satellite
        ? planet.radius *
          Math.max(1, MOON.orbitRadius * foreshorten + MOON.radius)
        : planet.radius,
    });
  }
  return list;
}

/**
 * Whether every body clears the reserved margins at this distance.
 *
 * Projection by hand rather than through a camera object: this runs inside a
 * bisection on every resize, and a `PerspectiveCamera` per probe would allocate
 * and rebuild matrices a few hundred times for a number we can write in four
 * lines. The camera looks down at `elevation` with no roll, so its basis is
 * right = +X, up = (0, cos e, -sin e), and back = (0, sin e, cos e).
 */
function framesAt(
  bodies: readonly Extent[],
  tier: CameraTier,
  aspect: number,
  distance: number,
): boolean {
  const elevation = (tier.elevation * Math.PI) / 180;
  const sin = Math.sin(elevation);
  const cos = Math.cos(elevation);
  const [tx, , tz] = tier.target;
  const cameraY = distance * sin;
  const cameraZ = tz + distance * cos;
  const halfFov = Math.tan((tier.fov * Math.PI) / 360);

  for (const body of bodies) {
    const vx = body.x - tx;
    const vy = -cameraY;
    const vz = body.z - cameraZ;
    // Positive in front of the camera.
    const depth = -(vy * sin + vz * cos);
    if (depth <= 0.1) return false;
    const span = halfFov * depth;
    const ndcX = vx / (span * aspect);
    const ndcY = (vy * cos - vz * sin) / span;
    const radiusY = body.radiusY / span;
    const radiusX = body.radiusX / span / aspect;
    if (ndcX - radiusX < -1 + MARGIN.x) return false;
    if (ndcX + radiusX > 1 - MARGIN.x) return false;
    if (ndcY - radiusY < -1 + MARGIN.bottom) return false;
    if (ndcY + radiusY > 1 - MARGIN.top) return false;
  }
  return true;
}

/** The distance at which the whole system clears its margins. Monotonic — every
 * body shrinks towards the centre as the camera retreats — so a bisection lands
 * on it exactly, and the authored distance is the floor. */
function fitDistance(tier: CameraTier, aspect: number): number {
  const bodies = extents(tier);
  let low = tier.distance;
  if (framesAt(bodies, tier, aspect, low)) return low;
  let high = low;
  // Grow first: a very narrow pane can need several times the authored shot.
  for (
    let step = 0;
    step < 8 && !framesAt(bodies, tier, aspect, high);
    step += 1
  ) {
    low = high;
    high *= 1.6;
  }
  for (let step = 0; step < 24; step += 1) {
    const mid = (low + high) / 2;
    if (framesAt(bodies, tier, aspect, mid)) high = mid;
    else low = mid;
  }
  return high;
}

/** Turns a measured pane into the camera that frames the composition in it. */
export function solveFraming(
  pixelWidth: number,
  pixelHeight: number,
): SolarFraming {
  const aspect = Math.max(0.2, pixelWidth / Math.max(1, pixelHeight));
  const tier = cameraTier(aspect);
  const distance = fitDistance(tier, aspect);
  const elevation = (tier.elevation * Math.PI) / 180;
  const [tx, ty, tz] = tier.target;
  return {
    fov: tier.fov,
    position: [
      tx,
      ty + distance * Math.sin(elevation),
      tz + distance * Math.cos(elevation),
    ],
    target: [tx, ty, tz],
    spread: tier.spread,
  };
}

/** Where a body rests, once the responsive spread is applied. */
export function orbitPosition(
  planet: PlanetConfig,
  spread: number,
  angleOffset: number,
): [number, number, number] {
  const angle = (planet.orbitAngle * Math.PI) / 180 + angleOffset;
  const radius = planet.orbitRadius * spread;
  return [Math.cos(angle) * radius, 0, -Math.sin(angle) * radius];
}

/**
 * The star's light.
 *
 * `intensity` is calibrated so a body at Earth's orbit is lit at roughly the
 * same level as the directional light the rest of the project's 3D pages use,
 * which keeps the planets looking like the same planets here as in the model
 * inspector. `decay` is a deliberate compromise: the physical value of 2 leaves
 * Uranus black, and 0 makes the system read as flat, so a low fractional decay
 * keeps a visible falloff outwards without losing the outer planets.
 */
export const SUN_LIGHT = {
  color: "#fff0d6",
  intensity: 9.5,
  decay: 0.45,
} as const;

export const NEAR_PLANE = 0.5;
export const FAR_PLANE = 300;

/** DPR ceilings. Nine textured bodies is a real fragment load, so the cap sits
 * below the 2x a phone would otherwise ask for. */
export const HARDWARE_DPR: [number, number] = [1, 1.5];
export const SOFTWARE_DPR = 0.5;

export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|lavapipe/i.test(renderer);
}
