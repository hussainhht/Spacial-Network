import { gsap } from "gsap";
import { center, localDelta } from "@/features/universe-transition/animation";

/**
 * The galaxy's entrance: the core star reacts, then every group planet is
 * generated out of it.
 *
 * A planet does not fade in at its final position. Its path starts at the core,
 * at a fraction of its size and no opacity, and spirals outward onto the orbit
 * slot the layout assigned it — the same curve the home planets were absorbed
 * along, run the other way. That is what makes the core read as a portal rather
 * than as decoration.
 *
 * Every transform written here lands on a dedicated emergence wrapper, never on
 * the orbit ring that the idle rotation owns and never on the button that hover
 * and selection own. Three writers, three elements: once the entrance finishes,
 * the ordinary orbit is already running underneath it and there is nothing to
 * hand over.
 */

/** Radians of orbit a planet sweeps on its way out of the core. */
const SWEEP = Math.PI * 1.15;
/** How small a planet is as it leaves the core. */
const EMERGE_SCALE = 0.2;
const EMERGE_DURATION = 0.62;
/** Per-planet stagger, tightening as the galaxy grows, and a hard cap on the
 * total so twenty groups do not make the reader wait for the twentieth. */
const MAX_STAGGER_SPAN = 0.8;

function staggerStep(count: number): number {
  if (count <= 1) return 0;
  const preferred = count <= 6 ? 0.11 : count <= 12 ? 0.07 : 0.045;
  return Math.min(preferred, MAX_STAGGER_SPAN / (count - 1));
}

/** Orders the planets by ring so the galaxy is generated from the inside out. */
function byRing(nodes: HTMLElement[]): HTMLElement[] {
  return [...nodes].sort(
    (a, b) =>
      Number(a.dataset.universeEmerge ?? 0) -
      Number(b.dataset.universeEmerge ?? 0),
  );
}

export function revealGalaxy(
  scene: HTMLElement,
  { reduced }: { reduced: boolean },
): gsap.core.Timeline | null {
  const core = scene.querySelector<HTMLElement>("[data-universe-core]");
  const nodes = byRing(
    Array.from(scene.querySelectorAll<HTMLElement>("[data-universe-emerge]")),
  );
  if (!core) return null;

  const timeline = gsap.timeline();

  if (reduced) {
    // Same outcome, no travel: the planets are simply there. Behaviour, focus
    // order and hit areas are identical either way.
    timeline.from(nodes, { opacity: 0, duration: 0.18, stagger: 0.01 }, 0);
    return timeline;
  }

  // One read per element, before anything is written. Reading a rect after the
  // first tween has started would measure a half-animated layout.
  const origin = center(core);
  const paths = nodes.map((node) => {
    const rest = center(node);
    // The vector from the planet's slot to the core, in the planet's own
    // transform space — through the ring rotation and the label's counter
    // rotation. At t=0 the planet is exactly on the core; at t=1 it is home.
    const delta = localDelta(node, origin.x - rest.x, origin.y - rest.y);
    const ring = Number(node.dataset.universeEmerge ?? 0);
    return {
      node,
      delta,
      length: Math.hypot(delta.x, delta.y),
      base: Math.atan2(-delta.y, -delta.x),
      // Alternating sweep direction, so consecutive rings unwind opposite ways
      // and the galaxy does not read as one rigid pinwheel.
      sweep: ring % 2 === 0 ? SWEEP : -SWEEP,
    };
  });

  const pulse = scene.querySelector<HTMLElement>("[data-universe-pulse]");
  const shock = scene.querySelector<HTMLElement>("[data-universe-shock]");
  const rings = Array.from(
    scene.querySelectorAll<HTMLElement>("[data-universe-ring]"),
  );

  // The core answers first — it is what the home planets just fell into.
  if (pulse)
    timeline.fromTo(
      pulse,
      { scale: 0.82 },
      { scale: 1, duration: 0.55, ease: "elastic.out(1, 0.62)" },
      0,
    );
  if (shock)
    timeline.fromTo(
      shock,
      { scale: 0.3, opacity: 0.75 },
      { scale: 3.4, opacity: 0, duration: 0.7, ease: "power2.out" },
      0.02,
    );
  // Then its orbits are drawn outward from it. The rings are concentric on the
  // core already, so a plain scale is a draw from the centre. Their inline
  // transform is cleared at the end: the stylesheet centres them with a
  // percentage translate, and GSAP can only round-trip that through a pixel
  // matrix — which a later resize would leave stale.
  if (rings.length)
    timeline.fromTo(
      rings,
      { scale: 0.12, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.58,
        stagger: 0.07,
        ease: "power3.out",
        onComplete: () => gsap.set(rings, { clearProps: "transform,opacity" }),
      },
      0.06,
    );

  const step = staggerStep(paths.length);
  for (const [index, path] of paths.entries()) {
    // One tween per planet, writing from a parametric spiral. GSAP owns the
    // progress; nothing here touches React, and the orbit rotation above keeps
    // running on a different element throughout.
    const progress = { t: 0 };
    const write = () => {
      const t = progress.t;
      const angle = path.base + path.sweep * (1 - t);
      const radius = path.length * t ** 0.85;
      gsap.set(path.node, {
        x: path.delta.x + Math.cos(angle) * radius,
        y: path.delta.y + Math.sin(angle) * radius,
        scale: EMERGE_SCALE + (1 - EMERGE_SCALE) * t,
        opacity: Math.min(1, t * 2.2),
      });
    };
    write();
    timeline.to(
      progress,
      {
        t: 1,
        duration: EMERGE_DURATION,
        ease: "power2.out",
        onUpdate: write,
        // Hand the slot back to the layout rather than leaving a rounded
        // inline transform sitting on top of it.
        onComplete: () => gsap.set(path.node, { clearProps: "all" }),
      },
      0.24 + index * step,
    );
  }

  return timeline;
}
