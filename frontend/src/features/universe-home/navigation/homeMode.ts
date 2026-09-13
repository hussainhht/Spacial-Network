/** Universe Home v1 mode switch (DECISIONS D09).
 *
 * The legacy Home ↔ Groups Earth cinematic is written against the old orbital
 * feed's anchors, its EarthHandle and body scroll locks. None of that describes
 * the three-planet homepage, so under v1 the provider declines to intercept
 * `/` ↔ `/groups` navigation and the existing Next Links route normally.
 *
 * This is a module constant on purpose: a runtime flag set on first visit to
 * Home would behave differently on a direct `/groups` load or a hard refresh,
 * which the shared contract forbids. The legacy implementation is left intact
 * and isolated behind this switch for a later redesign, not rewritten.
 *
 * Typed as `boolean` rather than a literal so the retained legacy branches stay
 * type-checked instead of being narrowed away as unreachable code.
 */
export const UNIVERSE_HOME_V1_ENABLED: boolean = true;

/** Whether `/` is still the three-planet loop.
 *
 * Phase 1 of the Solar System home gives `/` its own scene — see
 * `features/solar-system` — so the persistent universe canvas no longer mounts
 * there. Two WebGL contexts on one route is exactly what this switch exists to
 * prevent: the canvas is portalled from the shell provider, which wraps every
 * route, so without a flag it would keep drawing behind the new home.
 *
 * Groups is untouched: it docks the same persistent canvas as before. Posts no
 * longer does. Home and Posts share the solar system's own persistent scene,
 * mounted once by the app shell (`solar-system/PersistentUniverseScene`), and
 * the provider skips this canvas on both routes. The loop implementation is
 * left intact behind this switch.
 *
 * A module constant, for the same reason as the switch above: a runtime flag
 * would behave differently on a direct load of `/posts` than on a visit to it
 * from `/`, and the shared contract forbids that.
 */
export const UNIVERSE_LOOP_HOME_ENABLED: boolean = false;
