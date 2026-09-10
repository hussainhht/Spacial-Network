import type { PlanetDestination, PlanetId } from "../contracts";

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
