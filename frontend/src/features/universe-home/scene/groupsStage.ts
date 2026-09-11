/** The Groups composition: where Mars rests, and where the galaxy's core is.
 *
 * Same contract as `postsStage.ts`, for the same reason. Two independent
 * systems have to agree on this geometry:
 *
 * - the 3D scene places the Mars rig at the Mars anchor, and collapses Earth,
 *   Saturn and the Moon into the star anchor;
 * - the Groups galaxy positions its `YOU` core on the star anchor and sizes its
 *   orbit rings from the galaxy diameter.
 *
 * Expressing all of it as a pure function of the docked viewport's pixel box
 * means neither has to measure the other. That matters more here than on Posts:
 * the absorption is choreographed on Home, *before* the Groups DOM exists, so
 * the target cannot be read from a layout — it has to be predicted, and then
 * honoured by the page that arrives.
 *
 * Coordinates are CSS pixels relative to the docked viewport's top-left, which
 * is also the canvas's own coordinate space.
 */

export type GroupsAnchor = {
  /** Centre of Mars's visible disc. */
  x: number;
  y: number;
  /** Diameter of that disc. */
  diameter: number;
};

export type GroupsComposition = {
  mars: GroupsAnchor;
  /** Centre of the galaxy's core star — the portal the home planets vanish
   * into, and the point the group planets emerge from. */
  star: { x: number; y: number };
  /** Diameter of the square the orbit rings are laid out in. The rings are
   * authored as percentages of it, so one number scales the whole galaxy. */
  galaxy: number;
};

/** See `starY` below. */
type StarY =
  | { fraction: number }
  | { offsetTop: number };

type CompositionTier = {
  /** Mars: centre as a fraction of the viewport, then diameter caps as
   * fractions of width and height. The smaller cap wins, so a short landscape
   * pane shrinks Mars instead of letting it crowd the navbar. */
  marsX: number;
  marsY: number;
  marsWidthRatio: number;
  marsHeightRatio: number;
  /** Core star centre. `starX` is always a fraction of the width. `starY` is a
   * fraction of the height where the galaxy is centred on the pane, and a pixel
   * offset from the top where the flow fallback places the core a fixed
   * distance below the controls — which is what it actually does, and modelling
   * it as a fraction put the absorption target up to 80px off on a tall pane. */
  starX: number;
  starY: StarY;
  /** Galaxy diameter caps, as fractions of width and height. */
  galaxyWidthRatio: number;
  galaxyHeightRatio: number;
};

/** Distance from the top of the pane to the core's centre in the flow fallback:
 * the controls' offset (~52px plus its own inset), the scene's top padding, and
 * half the core. Measured against the stylesheet rather than guessed, and it is
 * genuinely a constant there — the layout does not scale it with the pane. */
const FLOW_STAR_TOP = 185;

// Upper left, clear of the navbar above it and of the outermost orbit ring to
// its lower right. ~11% of the viewport width on a desktop pane: a location
// marker, not the subject of the scene.
const DESKTOP: CompositionTier = {
  marsX: 0.12,
  marsY: 0.21,
  marsWidthRatio: 0.11,
  marsHeightRatio: 0.22,
  // Slightly left of centre: the group preview panel opens against the right
  // edge, and the galaxy has to stay clear of it rather than slide out of view.
  starX: 0.47,
  starY: { fraction: 0.53 },
  galaxyWidthRatio: 0.52,
  galaxyHeightRatio: 0.78,
};

// A narrower pane cannot spare the lateral room, so the galaxy takes the width
// it has and the core drops towards the middle of the pane.
const TABLET: CompositionTier = {
  marsX: 0.13,
  marsY: 0.18,
  marsWidthRatio: 0.13,
  marsHeightRatio: 0.18,
  // Below 1000px the galaxy falls back to a flowing grid of group planets under
  // the core (see `GroupGalaxy.module.css`). The core then sits below the filter
  // controls at a fixed distance — the controls' offset, the scene's own top
  // padding and half the core — which is why these two tiers use a pixel offset
  // and share it. Their galaxy diameter is unused: the flow layout sizes itself.
  starX: 0.5,
  starY: { offsetTop: FLOW_STAR_TOP },
  galaxyWidthRatio: 0.8,
  galaxyHeightRatio: 0.68,
};

// Portrait keeps the tablet logic and shrinks everything: Mars tucks into the
// corner beside the core rather than well clear of it.
const MOBILE: CompositionTier = {
  marsX: 0.16,
  marsY: 0.12,
  marsWidthRatio: 0.2,
  marsHeightRatio: 0.12,
  starX: 0.5,
  starY: { offsetTop: FLOW_STAR_TOP },
  galaxyWidthRatio: 0.92,
  galaxyHeightRatio: 0.5,
};

/** Breakpoints match `GroupGalaxy.module.css` exactly. The galaxy's flow
 * fallback and this module have to change tier on the same pixel, or the core
 * the planets dive into would not be the core the page renders. */
export function compositionTier(pixelWidth: number): CompositionTier {
  if (pixelWidth >= 1000) return DESKTOP;
  if (pixelWidth >= 600) return TABLET;
  return MOBILE;
}

export function groupsComposition(
  width: number,
  height: number,
): GroupsComposition {
  const tier = compositionTier(width);
  return {
    mars: {
      x: width * tier.marsX,
      y: height * tier.marsY,
      diameter: Math.min(
        width * tier.marsWidthRatio,
        height * tier.marsHeightRatio,
      ),
    },
    star: {
      x: width * tier.starX,
      y:
        "fraction" in tier.starY
          ? height * tier.starY.fraction
          : Math.min(tier.starY.offsetTop, height * 0.5),
    },
    galaxy: Math.min(
      width * tier.galaxyWidthRatio,
      height * tier.galaxyHeightRatio,
    ),
  };
}
