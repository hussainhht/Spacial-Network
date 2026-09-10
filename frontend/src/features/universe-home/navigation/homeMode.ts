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
