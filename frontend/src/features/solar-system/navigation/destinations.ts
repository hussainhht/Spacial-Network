import type { PlanetId, SolarBodyId } from "../config/planets";

/**
 * Where the persistent universe camera can be.
 *
 * Every camera coordinate the navigation uses is authored here and nowhere
 * else. A destination is not a literal `{ position, lookAt }` pair, for two
 * reasons the scene imposes:
 *
 * - The bodies move. Earth takes about half an hour to go round the Sun, so a
 *   reader who lingers on Home arrives at an Earth that is somewhere else, and
 *   one who lingers on Posts would watch a fixed camera lose it. A body
 *   destination is therefore expressed *around its body* and resolved against
 *   the body's live world position every frame (`cameraPose.ts`).
 * - The pane changes shape. As with the Home framing in `composition.ts`, one
 *   camera cannot compose a 21:9 monitor and a phone, so each body destination
 *   carries a tier per aspect ratio.
 *
 * Adding a destination — Mars for Groups, Venus for Profile — is one entry in
 * `UNIVERSE_DESTINATIONS` plus its tiers; the camera controller, the transition
 * timeline and the page overlays do not change.
 */
export type UniverseDestinationId = "home" | "earth-posts";

/** A route the persistent scene stays mounted across. */
export type UniverseRoute = "/" | "/posts";

/**
 * A camera composed around one body, in that body's own frame.
 *
 * The frame is the body's orbit, not the world: "behind" is the direction the
 * body has come from along its ring, and "sunward" is towards the star. Because
 * it turns with the orbit, the Sun always lights the body from the same side of
 * the screen, so the terminator the reader sees on arrival is the one they keep.
 */
export type BodyCameraTier = {
  /** Lower bound of the pane aspect ratio (width / height) this tier serves. */
  minAspect: number;
  /** Which page layout the overlay uses with this framing. */
  layout: CompositionLayout;
  fov: number;
  /** Camera distance from the body's centre, in the body's display radii. */
  distance: number;
  /** Degrees the viewpoint is swung from trailing the body towards the Sun.
   * 0 sees the body exactly half lit; larger values show more of the day side
   * and push the terminator towards the far limb. */
  azimuth: number;
  /** Degrees above the orbital plane. */
  elevation: number;
  /** Where the body's centre sits on screen, in normalized device coordinates
   * (-1..1, +x right, +y up). This is what leaves the content area free. */
  screen: readonly [number, number];
};

/** `side` keeps the body right of centre with content to its left; `stacked`
 * puts the body at the top of a tall pane and the content below it. */
export type CompositionLayout = "side" | "stacked";

export type UniverseDestination = {
  id: UniverseDestinationId;
  route: UniverseRoute;
  /** The section's name, as navigation controls show it. */
  label: string;
  camera:
    | {
        /** The whole-system framing solved per pane in `composition.ts`. */
        kind: "system";
      }
    | {
        kind: "body";
        body: PlanetId;
        /** Ordered widest first; the first tier whose `minAspect` the pane
         * meets is used. The last must have `minAspect: 0`. */
        tiers: readonly BodyCameraTier[];
      };
};

/**
 * Earth, composed for Posts.
 *
 * Earth sits right of centre and the day side faces left, towards the content:
 * the Sun is always on that side in this frame, which is what keeps a lit limb
 * next to the text rather than a black one.
 *
 * The camera looks down on Earth from well above the orbital plane. That is the
 * decisive choice, calibrated against the real scene: from low down, whichever
 * planet happens to lie beyond Earth — usually Jupiter — sits directly behind
 * it, and the inner planets fill the content column. From above, the rest of
 * the system falls away past the edges of the frame, and the Moon's orbit opens
 * into a ring around the planet that keeps it off the text.
 *
 * Narrow panes move Earth to the top and leave the lower part to the page; the
 * camera backs off there so the planet still reads as a whole globe.
 */
const EARTH_POSTS_TIERS: readonly BodyCameraTier[] = [
  {
    minAspect: 1.45,
    layout: "side",
    fov: 30,
    distance: 7.6,
    azimuth: 70,
    elevation: 54,
    screen: [0.54, 0.06],
  },
  {
    minAspect: 1.05,
    layout: "side",
    fov: 32,
    distance: 8.2,
    azimuth: 70,
    elevation: 60,
    screen: [0.54, 0.08],
  },
  {
    minAspect: 0.7,
    layout: "stacked",
    fov: 36,
    distance: 10.5,
    azimuth: 15,
    elevation: 52,
    screen: [-0.06, 0.6],
  },
  {
    // A phone: the Moon's orbit is flattened a little further and Earth sits
    // higher, so the satellite spends most of each lap above the title.
    minAspect: 0,
    layout: "stacked",
    fov: 40,
    distance: 11.5,
    azimuth: 15,
    elevation: 48,
    screen: [-0.06, 0.68],
  },
];

export const UNIVERSE_DESTINATIONS: Record<
  UniverseDestinationId,
  UniverseDestination
> = {
  home: {
    id: "home",
    route: "/",
    label: "Solar system",
    camera: { kind: "system" },
  },
  "earth-posts": {
    id: "earth-posts",
    route: "/posts",
    label: "Posts",
    camera: { kind: "body", body: "earth", tiers: EARTH_POSTS_TIERS },
  },
};

const BY_ROUTE = new Map<string, UniverseDestinationId>(
  Object.values(UNIVERSE_DESTINATIONS).map((destination) => [
    destination.route,
    destination.id,
  ]),
);

const BY_BODY = new Map<SolarBodyId, UniverseDestination>(
  Object.values(UNIVERSE_DESTINATIONS).flatMap((destination) =>
    destination.camera.kind === "body"
      ? [[destination.camera.body, destination] as const]
      : [],
  ),
);

/** The destination a route belongs to, or null for a route the persistent
 * scene is not mounted on at all. */
export function destinationForRoute(
  pathname: string,
): UniverseDestinationId | null {
  return BY_ROUTE.get(pathname) ?? null;
}

export function isUniverseRoute(pathname: string): pathname is UniverseRoute {
  return BY_ROUTE.has(pathname);
}

/** The section a body opens, or null for a body with no destination yet. */
export function destinationForBody(
  body: SolarBodyId,
): UniverseDestination | null {
  return BY_BODY.get(body) ?? null;
}

export function bodyCameraTier(
  tiers: readonly BodyCameraTier[],
  aspect: number,
): BodyCameraTier {
  return (
    tiers.find((tier) => aspect >= tier.minAspect) ?? tiers[tiers.length - 1]
  );
}

/** The page layout every destination overlay should use for this pane. Earth
 * is the reference composition while it is the only body destination. */
export function compositionLayout(aspect: number): CompositionLayout {
  return bodyCameraTier(EARTH_POSTS_TIERS, aspect).layout;
}

/**
 * The transition, in seconds.
 *
 * One timeline sequences all of it (`UniverseNavigationProvider`): the page UI
 * fades out, the camera travels, the route changes behind UI that is already
 * invisible, the camera settles, and the destination UI fades in. The UI fades
 * themselves are run by `useDestinationPresence` from these same numbers.
 */
export const TRAVEL_TIMING = {
  uiOut: 0.35,
  cameraStart: 0.1,
  camera: 1.7,
  /** After `uiOut`, so the departing page is already invisible when React
   * swaps it for the destination. */
  routeAt: 0.4,
  uiIn: 0.34,
} as const;

/**
 * The reduced-motion variant: no flight. The UI and the scene fade, the camera
 * is placed at the destination while the scene is dark, and both fade back. The
 * reader lands on exactly the same composition, without watching it move.
 */
export const REDUCED_TIMING = {
  uiOut: 0.16,
  sceneOut: 0.22,
  /** Camera placed and route pushed, with the scene fully faded. */
  cutAt: 0.24,
  sceneIn: 0.26,
  uiIn: 0.18,
} as const;
