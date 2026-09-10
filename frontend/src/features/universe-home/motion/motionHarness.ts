/**
 * Owner-local test harness for Universe Home loop motion.
 *
 * Covers the pure math the loop rests on: the closed orbit path, its exact
 * periodicity (which is what makes the wrap invisible), circular index
 * arithmetic and wheel-delta normalization.
 *
 * Node's ESM resolver cannot follow the project's extensionless imports, which
 * belong to production code, so run it the way navigationHarness.ts documents
 * (from `frontend`):
 *
 *   ./node_modules/.bin/tsc --outDir /tmp/universe-home/build \
 *     --module commonjs --moduleResolution node --target es2022 \
 *     --skipLibCheck --esModuleInterop --types node --lib es2022,dom \
 *     src/features/universe-home/motion/motionHarness.ts
 *   node /tmp/universe-home/build/motion/motionHarness.js
 */

import {
  createPlacement,
  orbitNearness,
  placeOnOrbit,
  type OrbitFraming,
  type OrbitPlacement,
} from "./orbitPath";
import { normalizeWheelDelta } from "./wheelInput";
import {
  shortestStep,
  wrapIndex,
  wrapOffset,
  wrapPhase,
} from "../navigation/planetLoop";
import { PLANET_ORDER } from "../navigation/planetDestinations";

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  results.push({
    name,
    passed: condition,
    details: condition ? undefined : details || "Assertion failed",
  });
}

function assertClose(
  actual: number,
  expected: number,
  name: string,
  tolerance = 1e-9,
) {
  const diff = Math.abs(actual - expected);
  assert(
    diff <= tolerance,
    name,
    `Expected ${expected}, got ${actual} (diff ${diff})`,
  );
}

const FRAMING: OrbitFraming = {
  xCenter: -1.16,
  xRadius: 3.98,
  yCenter: 0,
  yRadius: 3.18,
  zCenter: -4.5,
  zRadius: 4.5,
  scaleNear: 1,
  scaleFar: 0.3,
};

const N = PLANET_ORDER.length;
const at = (offset: number): OrbitPlacement =>
  placeOnOrbit(offset, N, FRAMING, createPlacement());

export function runMotionHarness(): boolean {
  // --- The three resting slots ------------------------------------------
  const focus = at(0);
  const previous = at(-1);
  const next = at(1);

  assertClose(focus.x, FRAMING.xCenter + FRAMING.xRadius, "Focus sits at the front of the orbit");
  assertClose(focus.y, 0, "Focus sits on the horizon line");
  assertClose(focus.z, 0, "Focus sits on the measured z=0 framing plane");
  assertClose(focus.scale, 1, "Focus is drawn at full scale");

  assert(previous.y > 0, "Previous planet rides above the focus", `y=${previous.y}`);
  assert(next.y < 0, "Next planet sits below the focus", `y=${next.y}`);
  assert(previous.x < focus.x && next.x < focus.x, "Both neighbours sit left of the focus");
  assert(previous.z < focus.z && next.z < focus.z, "Both neighbours sit further from the camera");
  assertClose(previous.scale, next.scale, "Neighbours are drawn at a matching scale");
  assert(
    previous.scale > 0.25 && previous.scale < 0.55,
    "A neighbour reads as present but subordinate",
    `scale=${previous.scale}`,
  );
  assertClose(previous.x, next.x, "Neighbours mirror across the horizon line");

  // --- Periodicity: the property the seamless loop depends on -----------
  // Adding a whole turn must reproduce the placement bit for bit, because that
  // is what lets the phase be renormalized after every step with no jump.
  for (const offset of [0, -1, 1, 0.5, -0.37, 2.4]) {
    const base = at(offset);
    const turned = at(offset + N);
    const back = at(offset - N);
    assertClose(turned.x, base.x, `Offset ${offset} + N reproduces x`, 1e-12);
    assertClose(turned.y, base.y, `Offset ${offset} + N reproduces y`, 1e-12);
    assertClose(turned.z, base.z, `Offset ${offset} + N reproduces z`, 1e-12);
    assertClose(turned.scale, base.scale, `Offset ${offset} + N reproduces scale`, 1e-12);
    assertClose(back.x, base.x, `Offset ${offset} - N reproduces x`, 1e-12);
  }

  // --- The recycled planet travels; it never teleports ------------------
  // Going forward, the previous planet leaves -1 and arrives at -2 (which is
  // +1 on the ring). Sampling that sweep must stay continuous and must never
  // pass back in front of the camera.
  let maxStep = 0;
  let maxZ = -Infinity;
  let sample = at(-1);
  for (let i = 1; i <= 200; i += 1) {
    const current = at(-1 - i / 200);
    maxStep = Math.max(
      maxStep,
      Math.hypot(current.x - sample.x, current.y - sample.y, current.z - sample.z),
    );
    maxZ = Math.max(maxZ, current.z);
    sample = current;
  }
  assert(maxStep < 0.2, "The wrapping planet moves continuously", `largest step ${maxStep}`);
  assert(maxZ <= previous.z + 1e-9, "The wrapping planet stays behind the neighbours", `maxZ=${maxZ}`);
  assertClose(sample.x, next.x, "The wrapping planet lands exactly on the next slot", 1e-9);
  assertClose(sample.y, next.y, "The wrapping planet lands at the next slot's height", 1e-9);

  // --- Forward and backward loops both close ----------------------------
  for (const direction of [1, -1]) {
    const label = direction === 1 ? "forward" : "backward";
    // `raw` is what the phase would be if it were never renormalized; `wrapped`
    // is what the loop actually stores. Both must place every planet in the
    // same spot, which is the guarantee that the wrap is never seen.
    let raw = 0;
    let wrapped = 0;
    for (let step = 0; step < 24; step += 1) {
      raw += direction;
      wrapped = wrapPhase(wrapped + direction, N);
      for (let i = 0; i < N; i += 1) {
        const drifted = at(i - raw);
        const renormalized = at(i - wrapped);
        assertClose(drifted.x, renormalized.x, `${label} step ${step + 1}: planet ${i} keeps its x`, 1e-9);
        assertClose(drifted.y, renormalized.y, `${label} step ${step + 1}: planet ${i} keeps its y`, 1e-9);
        assertClose(drifted.scale, renormalized.scale, `${label} step ${step + 1}: planet ${i} keeps its scale`, 1e-9);
      }
    }
    assert(
      PLANET_ORDER[wrapIndex(Math.round(wrapped), N)] ===
        PLANET_ORDER[wrapIndex(Math.round(raw), N)],
      `24 ${label} steps name the same destination with and without renormalizing`,
    );
  }

  // --- Emphasis ---------------------------------------------------------
  assertClose(orbitNearness(0, N), 1, "The focus is fully emphasised");
  assert(orbitNearness(1, N) < 0.3, "A neighbour is well below the focus", `${orbitNearness(1, N)}`);
  assertClose(orbitNearness(1, N), orbitNearness(-1, N), "Emphasis is symmetric");

  // --- Circular index arithmetic ----------------------------------------
  assert(wrapIndex(-1, N) === N - 1, "wrapIndex carries -1 to the last destination");
  assert(wrapIndex(N, N) === 0, "wrapIndex carries N back to the first destination");
  assert(wrapIndex(-7, N) === wrapIndex(-7 + 3 * N, N), "wrapIndex is stable over many turns");
  assertClose(wrapPhase(-0.25, N), N - 0.25, "wrapPhase folds a negative phase forward");
  assertClose(wrapPhase(7.5, 3), 1.5, "wrapPhase folds a large phase back");
  assert(wrapOffset(2, 3) === -1, "wrapOffset takes the short way round");
  assert(wrapOffset(-2, 3) === 1, "wrapOffset takes the short way round in reverse");
  assert(shortestStep(0, 2, 3) === -1, "Earth reaches Saturn backwards in one step");
  assert(shortestStep(2, 0, 3) === 1, "Saturn reaches Earth forwards in one step");
  assert(shortestStep(0, 1, 3) === 1, "Earth reaches Mars forwards in one step");
  assert(shortestStep(1, 1, 3) === 0, "A destination already in focus needs no step");
  assert(Math.abs(shortestStep(0, 2, 4)) === 2, "An even ring resolves the antipode deterministically");

  // --- Wheel normalization ----------------------------------------------
  const wheel = (init: Partial<WheelEvent>) =>
    normalizeWheelDelta(
      { deltaY: 0, deltaX: 0, deltaMode: 0, ...init } as WheelEvent,
      900,
    );
  assertClose(wheel({ deltaY: 42 }), 42, "Pixel deltas pass through unchanged");
  assertClose(wheel({ deltaY: 3, deltaMode: 1 }), 48, "Line deltas are scaled to pixels");
  assertClose(wheel({ deltaY: 1, deltaMode: 2 }), 900, "Page deltas are scaled to the pane");
  assertClose(wheel({ deltaX: -30 }), -30, "A horizontal-only swipe still reads as travel");
  assertClose(wheel({ deltaY: 12, deltaX: -30 }), -30, "The dominant axis wins");

  let allPassed = true;
  console.log("\n--- Orbit Path & Loop Math Test Results ---");
  for (const r of results) {
    if (r.passed) {
      console.log(`  PASS: ${r.name}`);
    } else {
      console.error(`  FAIL: ${r.name} - ${r.details}`);
      allPassed = false;
    }
  }
  console.log(
    `\nTotal tests: ${results.length}, Passed: ${results.filter((r) => r.passed).length}, Failed: ${results.filter((r) => !r.passed).length}\n`,
  );

  return allPassed;
}

// Self-run when executed directly
if (
  typeof process !== "undefined" &&
  process.argv &&
  /motionHarness\.[cm]?[jt]s$/.test(process.argv[1] ?? "")
) {
  const passed = runMotionHarness();
  process.exit(passed ? 0 : 1);
}
