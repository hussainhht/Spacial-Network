import { gsap } from "gsap";
import type { EarthHandle, Point } from "./types";
export const center = (element: Element): Point => {
  const r = element.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
export const elements = (root: HTMLElement, kind: string) =>
  Array.from(root.querySelectorAll<HTMLElement>(`[data-universe-${kind}]`));
const controls = (root: HTMLElement) => elements(root, "ui");

// All reads happen when building each half of the timeline, never in onUpdate.
export function exitScene(
  tl: gsap.core.Timeline,
  root: HTMLElement,
  point: Point,
  forward: boolean,
) {
  tl.to(controls(root), { opacity: 0, y: -8, duration: 0.25 }, 0.06);
  const nodes = elements(root, forward ? "post" : "node");
  nodes.forEach((node, i) => {
    const p = center(node);
    // Group buttons are inside counter-rotating parents, so convert the screen
    // vector through the ancestor matrix (also works for the mobile list).
    const delta = localDelta(node, point.x - p.x, point.y - p.y);
    tl.to(
      node,
      {
        x: `+=${delta.x * (forward ? 0.24 : 1)}`,
        y: `+=${delta.y * (forward ? 0.24 : 1)}`,
        scale: forward ? 0.65 : 0.02,
        rotation: forward ? (i % 2 ? 5 : -4) : 0,
        opacity: 0,
        duration: forward ? 0.45 : 0.48,
      },
      0.12 + Math.min(i, 12) * 0.025,
    );
  });
  if (!forward) {
    tl.to(
      elements(root, "ring"),
      { scale: 0.02, opacity: 0, rotation: -16, stagger: 0.05, duration: 0.4 },
      0.25,
    );
    tl.to(elements(root, "you"), { opacity: 0, duration: 0.25 }, 0.36);
  }
}
function localDelta(node: HTMLElement, x: number, y: number) {
  let matrix = new DOMMatrix();
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const transform = getComputedStyle(parent).transform;
    if (transform !== "none")
      matrix = new DOMMatrix(transform).multiply(matrix);
  }
  const inverse = matrix.inverse();
  return { x: inverse.a * x + inverse.c * y, y: inverse.b * x + inverse.d * y };
}
export function enterScene(
  tl: gsap.core.Timeline,
  root: HTMLElement,
  point: Point,
  forward: boolean,
  at: number,
) {
  if (forward) {
    for (const ring of elements(root, "ring")) {
      const r = ring.getBoundingClientRect();
      gsap.set(ring, {
        transformOrigin: `${point.x - r.left}px ${point.y - r.top}px`,
      });
    }
    tl.from(
      elements(root, "ring"),
      { scale: 0.02, opacity: 0, rotation: -16, duration: 0.62, stagger: 0.06 },
      at,
    );
    tl.from(elements(root, "you"), { opacity: 0, duration: 0.32 }, at + 0.35);
  }
  elements(root, forward ? "node" : "post").forEach((node, i) => {
    // A paused CSS appear animation still overrides inline GSAP transforms.
    // Suppress it for these mounted nodes, including after the handoff ends.
    if (forward) node.dataset.universeEntered = "true";
    const p = center(node);
    const delta = localDelta(
      node,
      (point.x - p.x) * (forward ? 1 : 0.2),
      (point.y - p.y) * (forward ? 1 : 0.2),
    );
    tl.from(
      node,
      {
        x: `+=${delta.x}`,
        y: `+=${delta.y}`,
        scale: forward ? 0.02 : 0.65,
        opacity: 0,
        duration: 0.5,
        immediateRender: true,
      },
      at + 0.12 + Math.min(i, 12) * 0.025,
    );
  });
  tl.from(
    controls(root),
    { opacity: 0, y: 10, duration: 0.32, stagger: 0.015 },
    at + 0.4,
  );
}
export function moveEarth(
  tl: gsap.core.Timeline,
  stage: HTMLElement,
  earth: EarthHandle | null,
  origin: DOMRect,
  target: Point,
  at: number,
  reverse = false,
) {
  const dx = target.x - (origin.left + origin.width / 2);
  const dy = target.y - (origin.top + origin.height / 2);
  const fraction = earth ? 0.2 : 0;
  const units = earth?.unitsPerPixel() ?? 0;
  // The stable canvas carries 80% of the screen travel; the actual Three group
  // carries 20%, plus all rotation and collapse. This preserves original Bounds
  // framing and leaves ample canvas margin without another WebGL renderer.
  tl.to(
    stage,
    {
      x: reverse ? 0 : dx * (1 - fraction),
      y: reverse ? 0 : dy * (1 - fraction),
      duration: 0.8,
    },
    at,
  );
  if (earth) {
    tl.to(
      earth.group.position,
      {
        x: reverse ? 0 : dx * fraction * units,
        y: reverse ? 0 : -dy * fraction * units,
        duration: 0.8,
      },
      at,
    );
    tl.to(earth.group.rotation, { y: "+=3.8", duration: 0.9 }, at);
    tl.to(
      earth.group.scale,
      {
        x: reverse ? 1 : 1.08,
        y: reverse ? 1 : 1.08,
        z: reverse ? 1 : 1.08,
        duration: reverse ? 0.4 : 0.65,
      },
      at,
    );
  }
}
