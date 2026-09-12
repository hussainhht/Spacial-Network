import { DEV_MODELS, type DevModel } from "@/components/space/modelsRegistry";

/** Bodies the home scene can draw. Neptune has no model in the registry yet, so
 * it is absent here rather than stubbed — adding the asset and one row below is
 * the whole change. */
export type PlanetId =
  "mercury" | "venus" | "earth" | "mars" | "jupiter" | "saturn" | "uranus";

export type SolarBodyId = "sun" | PlanetId;

/**
 * One body of the composition.
 *
 * Positions are polar rather than cartesian because every planet shares one
 * centre — the Sun — and its orbit ring is drawn from the same radius. Writing
 * `x`/`z` here instead would let a planet drift off its own ring.
 */
export type PlanetConfig = {
  id: PlanetId;
  name: string;
  /** Astronomical symbol, used by the dock. Deliberately not emoji: the dock is
   * one typographic set, and emoji render as colour glyphs on most platforms. */
  glyph: string;
  model: DevModel;
  /** Distance from the Sun in world units, before the responsive spread. Not to
   * scale: the outer system is compressed so the whole set frames at once. */
  orbitRadius: number;
  /** Where the body sits on its ring, in degrees. 0 points right of the Sun,
   * 90 points away from the camera. This is the composition: it is what decides
   * the screen position and the depth layer of every planet. */
  orbitAngle: number;
  /** Display radius in world units at spread 1. Art-directed, not to scale.
   * For Saturn this is the span of the rings, which is what the model's bounds
   * normalize to — its body reads at roughly 0.43 of it. */
  radius: number;
  /** Axial tilt in radians. Applied above the spin so the body turns about its
   * own tilted axis rather than about world up. */
  axialTilt: number;
  /** Which way the north pole leans, in degrees around the orbital plane, using
   * the same convention as `orbitAngle`.
   *
   * Irrelevant for a sphere, and decisive for Saturn: a ring is a flat disc, so
   * it is lit by how far its plane is tipped out of the starlight and by nothing
   * else. Leaning the pole along the body's own orbit angle points it at the
   * Sun, which is what opens the rings to the light instead of leaving them edge
   * on to it and black. */
  tiltDirection: number;
  /** Rotation about that axis, in radians per second. Negative is retrograde. */
  spinSpeed: number;
};

/** The registry is the single source of model paths. Its `defaultRotation` is a
 * per-model display pose for the inspector pages, and it would fight the axial
 * tilt this scene applies above the spin root, so it is neutralized here and
 * expressed as `axialTilt` instead. Frozen at module scope on purpose: the
 * shared GLTF renderers memoize their cloned scene on config identity, so a
 * fresh object per render would re-clone the model every frame. */
function modelFor(id: string): DevModel {
  const model = DEV_MODELS.find((entry) => entry.id === id);
  if (!model)
    throw new Error(`The solar system needs the canonical ${id} model.`);
  return { ...model, defaultRotation: [0, 0, 0] };
}

export const SUN_MODEL = modelFor("sun");
export const MOON_MODEL = modelFor("moon");

/** Ordered outward from the Sun. The order is the dock's order too, so the two
 * can never disagree about what the system contains. */
export const PLANETS: readonly PlanetConfig[] = [
  {
    id: "mercury",
    name: "Mercury",
    glyph: "☿",
    model: modelFor("mercury"),
    orbitRadius: 6.4,
    orbitAngle: -25,
    radius: 0.36,
    axialTilt: 0.03,
    tiltDirection: 0,
    spinSpeed: 0.02,
  },
  {
    id: "venus",
    name: "Venus",
    glyph: "♀",
    model: modelFor("venus"),
    orbitRadius: 9,
    orbitAngle: 40,
    radius: 0.76,
    axialTilt: 0.05,
    tiltDirection: 0,
    // Venus turns backwards. Cheap to honour, and it keeps neighbouring bodies
    // from drifting into visual lockstep.
    spinSpeed: -0.012,
  },
  {
    id: "earth",
    name: "Earth",
    glyph: "⊕",
    model: modelFor("earth"),
    orbitRadius: 12.2,
    orbitAngle: -8,
    radius: 1.55,
    axialTilt: 0.41,
    tiltDirection: 32,
    spinSpeed: 0.035,
  },
  {
    id: "mars",
    name: "Mars",
    glyph: "♂",
    model: modelFor("mars"),
    orbitRadius: 15.4,
    orbitAngle: 78,
    radius: 0.66,
    axialTilt: 0.44,
    tiltDirection: 120,
    spinSpeed: 0.03,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    glyph: "♃",
    model: modelFor("jupiter"),
    orbitRadius: 19.6,
    orbitAngle: 25,
    radius: 2.05,
    axialTilt: 0.05,
    tiltDirection: 0,
    spinSpeed: 0.048,
  },
  {
    id: "saturn",
    name: "Saturn",
    glyph: "♄",
    model: modelFor("saturn"),
    orbitRadius: 24,
    orbitAngle: 118,
    radius: 3.4,
    axialTilt: 0.4,
    tiltDirection: 118,
    spinSpeed: 0.04,
  },
  {
    id: "uranus",
    name: "Uranus",
    glyph: "♅",
    model: modelFor("uranus"),
    orbitRadius: 28.5,
    orbitAngle: 62,
    radius: 1.1,
    // Uranus lies on its side. The registry carried this as a display pose;
    // here it is the spin axis, so the planet rolls along its orbit instead of
    // wobbling inside a tilt that the rotation ignores.
    axialTilt: 1.71,
    tiltDirection: 0,
    spinSpeed: 0.026,
  },
];

export const SUN = {
  name: "Sun",
  glyph: "☉",
  radius: 2.1,
  spinSpeed: 0.01,
  /** Corona shell radius, as a multiple of the Sun's. Restrained on purpose:
   * the star has to light the system, not flood the page. */
  coronaScale: 1.22,
  /** Additive glow billboard, same units. Its gradient puts almost all of its
   * energy inside the first third, so the visible halo is far tighter than the
   * quad it is drawn on. */
  glowScale: 3,
} as const;

/**
 * Earth's satellite, in Earth radii — the Earth system is scaled as a unit, so
 * the Moon keeps its proportion to its parent at every breakpoint and can never
 * read as an unrelated body that happens to be nearby.
 */
export const MOON = {
  /** 0.27 of Earth, which is very nearly the real ratio. */
  radius: 0.27,
  orbitRadius: 2.05,
  /** Radians per second. One lap takes about three minutes: present, but never
   * the thing that pulls the eye. */
  orbitSpeed: 0.035,
  /** Starting angle, chosen to hold the Moon clear of Jupiter's side of frame. */
  orbitPhase: -2.2,
  orbitInclination: 0.09,
  spinSpeed: 0.018,
} as const;

/** EarthPlanetModel normalizes to its export bounds, which include an outer
 * shell wider than the visible globe. This is the compensation that makes its
 * surface radius exactly 1 before the display radius is applied — the same
 * ratio the universe-home scene uses. */
export const EARTH_MODEL_SCALE = 1938.6019216974796 / 1221.1297423308124;

/**
 * Orbital speed, in radians per second, for a ring of the given radius.
 *
 * Scaled by 1/√r so the inner system leads and the outer planets crawl, which
 * is the one piece of Kepler worth keeping: it makes the system read as one
 * mechanism. The constant is small enough that Earth takes about half an hour
 * to come round — the scene is never still, and it never rearranges itself
 * while it is being looked at.
 */
export const ORBIT_SPEED_SCALE = 0.011;
export function orbitSpeed(orbitRadius: number): number {
  return ORBIT_SPEED_SCALE / Math.sqrt(orbitRadius);
}

/** Clamp for the first frame after a tab is restored, so a long delta cannot
 * jump every body forward at once. */
export const MAX_FRAME_DELTA = 0.05;
