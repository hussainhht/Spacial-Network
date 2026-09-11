import type {
  PlanetDestination,
  PlanetId,
  UniverseStageId,
} from "../contracts";

/** Provisional destination mapping for v1, ordered Earth → Mars → Saturn along
 * the scroll track. This is the single source of both route targets and UI
 * strings; scene configuration references planets by id and never repeats a
 * route or an asset URL. Adding a destination later means extending PlanetId
 * and this array, not rewriting consumers. */
export const PLANET_DESTINATIONS: readonly PlanetDestination[] = [
  { id: "earth", label: "Earth", sectionLabel: "Posts", href: "/posts" },
  { id: "mars", label: "Mars", sectionLabel: "Groups", href: "/groups" },
  { id: "saturn", label: "Saturn", sectionLabel: "Profile", href: "/profile" },
];

/** Track order, derived so it can never drift from the configuration above. */
export const PLANET_ORDER: readonly PlanetId[] = PLANET_DESTINATIONS.map(
  (destination) => destination.id,
);

export function getPlanetDestination(id: PlanetId): PlanetDestination {
  const destination = PLANET_DESTINATIONS.find((entry) => entry.id === id);
  if (!destination)
    throw new Error(`Unknown planet destination "${id}" in PLANET_DESTINATIONS`);
  return destination;
}

/** Which planet owns each persistent-scene composition.
 *
 * A stage is the scene's arrangement on a destination route, and every stage
 * has exactly one subject: the planet that travels there and stays, while the
 * others leave. Routes are not repeated here — they are looked up through
 * `PLANET_DESTINATIONS` above, so a stage and its destination link can never
 * disagree about where the subject is going. */
export const UNIVERSE_STAGE_PLANETS = {
  posts: "earth",
  groups: "mars",
} as const satisfies Record<UniverseStageId, PlanetId>;

export const UNIVERSE_STAGES = Object.keys(
  UNIVERSE_STAGE_PLANETS,
) as readonly UniverseStageId[];

/** The subject of a composition: the planet that arrives rather than leaves. */
export function stagePlanet(stage: UniverseStageId): PlanetId {
  return UNIVERSE_STAGE_PLANETS[stage];
}

export function stageRoute(stage: UniverseStageId): string {
  return getPlanetDestination(stagePlanet(stage)).href;
}

/** The composition a route wants, or null for a route the scene does not dock
 * into at all. */
export function stageForRoute(pathname: string): UniverseStageId | null {
  return UNIVERSE_STAGES.find((stage) => stageRoute(stage) === pathname) ?? null;
}
