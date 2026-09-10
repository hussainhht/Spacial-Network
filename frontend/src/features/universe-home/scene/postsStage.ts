/** Where the persistent Earth rests on the Posts page.
 *
 * This is the single source of truth for that composition. The 3D scene reads
 * it to place the Earth rig, and the orbital feed reads it to centre the card
 * ellipse on the same point. Both measure the same box — the docked viewport —
 * so expressing the anchor as a pure function of that box's pixel size means
 * neither has to observe the other, and there is no measurement race between a
 * WebGL frame and a DOM layout.
 *
 * Coordinates are CSS pixels relative to the docked viewport's top-left, which
 * is also the canvas's own coordinate space.
 */
export type EarthAnchor = {
  /** Centre of the Earth's visible disc. */
  x: number;
  y: number;
  /** Diameter of the visible disc, excluding the Moon's orbit. */
  diameter: number;
};

type AnchorTier = {
  /** Centre, as a fraction of the viewport. */
  x: number;
  y: number;
  /** Diameter caps, as fractions of width and height. The smaller wins, so a
   * short landscape pane shrinks the Earth rather than cropping it. */
  widthRatio: number;
  heightRatio: number;
};

/** The Moon orbits at `EARTH_SYSTEM.orbitRadius + moonRadius` Earth radii, so
 * the composition has to leave that much clear of the right edge or the
 * satellite swings out of frame for half of every orbit. Every tier's width
 * ratio is chosen against this. */
const MOON_ENVELOPE = 1.88;

// Right and low: the reading column runs down the left and centre. Deliberately
// short of the corner — the Moon needs the room, and so does the eye.
const DESKTOP: AnchorTier = {
  x: 0.72,
  y: 0.62,
  widthRatio: 0.26,
  heightRatio: 0.46,
};
// Right of centre and a little higher: a narrower pane cannot spare the lateral
// room, so the cards pass above and below rather than only to the left.
const TABLET: AnchorTier = {
  x: 0.72,
  y: 0.56,
  widthRatio: 0.3,
  heightRatio: 0.4,
};
// Portrait keeps the lateral composition's logic but inverts the stacking: a
// card is as wide as the pane here, so a planet placed beside or above it is
// simply behind it. Earth goes low instead, cropped by the bottom-right corner,
// where the focused card clears it and it stays genuinely visible. The cards
// ride a narrow, nearly vertical arc above it — see `orbitFraming`.
const MOBILE: AnchorTier = {
  x: 0.76,
  y: 0.82,
  widthRatio: 0.52,
  heightRatio: 0.3,
};

export function anchorTier(pixelWidth: number): AnchorTier {
  if (pixelWidth >= 1024) return DESKTOP;
  if (pixelWidth >= 640) return TABLET;
  return MOBILE;
}

export function postsEarthAnchor(width: number, height: number): EarthAnchor {
  const tier = anchorTier(width);
  const x = width * tier.x;
  // Keeping the whole satellite orbit on screen costs Earth a lot of size, and
  // a portrait pane has none to spare — there the Moon is allowed to swing past
  // the edge, which is what a satellite does anyway.
  const moonLimit =
    width < 640 ? Infinity : ((width * 0.98 - x) * 2) / MOON_ENVELOPE;
  return {
    x,
    y: height * tier.y,
    diameter: Math.min(
      width * tier.widthRatio,
      height * tier.heightRatio,
      moonLimit,
    ),
  };
}

/** The card ellipse, in the same pixel space as the anchor.
 *
 * `FRONT_ANGLE` is the reading position: left of the Earth and slightly below
 * it. The ellipse is centred on the Earth, and its horizontal radius is derived
 * from where the focused card must sit rather than chosen independently, so the
 * two can never drift apart when the anchor tier changes. */
export const FRONT_ANGLE = 2.45;

export type OrbitFraming = {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  /** Shear applied along the horizontal axis, tilting the ellipse into the
   * plane of the scene instead of leaving it face-on. */
  tilt: number;
  /** Radians between consecutive cards. Wider on a narrow pane, where the
   * lateral spread is gone and only vertical separation keeps them apart. */
  angleStep: number;
  /** How far either side of the focus a card is still drawn, in slots. Bounding
   * the window is what keeps this a handful of live cards rather than the whole
   * feed, however long the feed grows. */
  behind: number;
  ahead: number;
};

export function orbitFraming(
  width: number,
  height: number,
  anchor: EarthAnchor,
  cardWidth: number,
): OrbitFraming {
  const compact = width < 640;
  // Where the focused card's centre belongs. Clamped so a narrow pane never
  // pushes the card off its own left edge.
  // Left of centre, but not hard against the edge: the ellipse's horizontal
  // radius is solved from this point, so pushing the focus further left widens
  // the whole orbit and swings the incoming card off the left of a narrow pane.
  const focusX = compact
    ? width / 2
    : Math.max(cardWidth / 2 + 24, width * 0.36);
  // Portrait reads top-down: the focused card sits above the planet rather than
  // beside it, with the next one cropped by the top edge.
  const focusY = height * (compact ? 0.44 : 0.56);

  // Only a floor against a degenerate measurement. On a portrait pane the
  // solved radius is genuinely small, and that is the point: the ellipse
  // narrows into the near-vertical arc the layout wants there.
  const radiusX = Math.max(48, (anchor.x - focusX) / -Math.cos(FRONT_ANGLE));
  const radiusY = height * (compact ? 0.32 : 0.24);
  const tilt = compact ? 0.05 : 0.09;
  // A portrait pane has almost no horizontal radius to separate cards with, so
  // it takes a wider step and shows one fewer of them; otherwise consecutive
  // cards land on top of each other and the depth fade reads as mud.
  const angleStep = compact ? 1.25 : 0.95;
  // Solve the centre from the focus rather than the other way round: the
  // reading position is the fixed point of this layout.
  return {
    centerX: anchor.x,
    centerY:
      focusY -
      radiusY * Math.sin(FRONT_ANGLE) -
      tilt * radiusX * Math.cos(FRONT_ANGLE),
    radiusX,
    radiusY,
    tilt,
    angleStep,
    behind: compact ? 1.5 : 2,
    ahead: compact ? 2 : 3,
  };
}
