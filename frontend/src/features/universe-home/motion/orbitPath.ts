/** The closed orbital path every destination travels along.
 *
 * A planet's place in the scene is a pure function of one number: its slot
 * offset from the focus (`index - phase`). The path is a tilted ellipse whose
 * front point is the focus, so:
 *
 *   offset  0  -> large, close, right of centre   (active)
 *   offset -1  -> small, distant, upper left      (previous)
 *   offset +1  -> small, distant, lower left      (next)
 *   offset ±N/2 -> smallest, furthest left        (the far side of the orbit)
 *
 * Everything is expressed through `cos`/`sin` of `2*pi*offset/count`, so the
 * path is exactly periodic in `count`. Two consequences matter:
 *
 * 1. A planet that leaves the "previous" slot does not teleport to the "next"
 *    slot. It keeps travelling round the far side, small and dim, and arrives
 *    there. There is no recycled slot to snap and no hidden element to reset.
 * 2. Adding or subtracting `count` from the phase produces bit-for-bit the same
 *    placement, so the loop can be renormalised after every step without any
 *    visible jump. See `navigation/planetLoop.wrapPhase`.
 */

export type OrbitFraming = {
  /** Ellipse centre and radius on the screen-horizontal axis, world units. */
  xCenter: number;
  xRadius: number;
  /** Vertical lift applied to the neighbours, world units. */
  yCenter: number;
  yRadius: number;
  /** Depth ellipse. `zCenter + zRadius` is the focus plane. */
  zCenter: number;
  zRadius: number;
  /** Multiplier applied at the focus and on the far side of the orbit. */
  scaleNear: number;
  scaleFar: number;
};

export type OrbitPlacement = {
  x: number;
  y: number;
  z: number;
  scale: number;
};

const TAU = Math.PI * 2;

/** How dominant a planet at this offset is: 1 at the focus, 0 on the far side.
 * Used for emphasis decisions that are not position, such as whether Earth's
 * Moon is worth drawing. */
export function orbitNearness(offset: number, count: number): number {
  if (count <= 0) return 1;
  return 0.5 + 0.5 * Math.cos((TAU * offset) / count);
}

/** Places a continuous slot offset on the orbit. Pure; allocates nothing that
 * outlives the call, and is safe to run for every planet on every frame. */
export function placeOnOrbit(
  offset: number,
  count: number,
  framing: OrbitFraming,
  out: OrbitPlacement,
): OrbitPlacement {
  const angle = count > 0 ? (TAU * offset) / count : 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const nearness = 0.5 + 0.5 * cos;
  out.x = framing.xCenter + framing.xRadius * cos;
  // Negated so a negative offset (the previous planet) rides high and a
  // positive offset (the next one) sits low: scrolling down lifts the planet
  // being left behind, which is the direction the gesture implies.
  out.y = framing.yCenter - framing.yRadius * sin;
  out.z = framing.zCenter + framing.zRadius * cos;
  out.scale =
    framing.scaleFar + (framing.scaleNear - framing.scaleFar) * nearness;
  return out;
}

export function createPlacement(): OrbitPlacement {
  return { x: 0, y: 0, z: 0, scale: 1 };
}

/** Falls a placement into a point along a shrinking spiral.
 *
 * `t` runs 0 → 1. At 0 the body is exactly where the orbit left it; at 1 it is
 * at the centre with no size. In between the angle sweeps while the radius
 * closes, which is what makes the path read as a body being drawn in rather
 * than sliding towards the middle.
 *
 * `yOffset` is added to the source's `y`: the caller's idle drift is not part of
 * the orbit placement, and passing it in means neither object has to be mutated
 * to combine them. `out` may safely be `from` — every source value is read
 * before anything is written.
 *
 * Pure, allocation-free and safe to run for every body on every frame. Running
 * it backwards (a falling `t`) retraces the same curve outwards, which is the
 * whole return animation.
 */
export function spiralToPoint(
  from: OrbitPlacement,
  yOffset: number,
  center: OrbitPlacement,
  t: number,
  sweep: number,
  out: OrbitPlacement,
): OrbitPlacement {
  const dx = from.x - center.x;
  const dy = from.y + yOffset - center.y;
  const fromZ = from.z;
  const fromScale = from.scale;
  const angle = Math.atan2(dy, dx) + sweep * t;
  // Ease the radius so the body spends its first half still recognisably in
  // orbit, then accelerates into the core.
  const radius = Math.hypot(dx, dy) * (1 - t) ** 1.35;
  out.x = center.x + Math.cos(angle) * radius;
  out.y = center.y + Math.sin(angle) * radius;
  out.z = fromZ + (center.z - fromZ) * t;
  // Collapse late: a body that shrinks early reads as fading out in place.
  out.scale = fromScale * (1 - t * t);
  return out;
}
