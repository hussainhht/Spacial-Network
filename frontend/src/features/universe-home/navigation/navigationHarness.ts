/**
 * Owner-local checks for Universe Home v1 navigation state and configuration.
 * Owned by Agent 3 (Next.js Navigation / Transition Architecture).
 *
 * Run from `frontend` (no npm test script exists and none was invented; the
 * repo's TypeScript compiles this owner-local harness to a scratch directory,
 * because Node's ESM resolver cannot follow the project's extensionless
 * imports and those imports belong to production code):
 *
 *   ./node_modules/.bin/tsc --outDir /tmp/universe-home-agent-3/build \
 *     --module commonjs --moduleResolution node --target es2022 \
 *     --skipLibCheck --types node \
 *     src/features/universe-home/navigation/navigationHarness.ts
 *   node --test /tmp/universe-home-agent-3/build/navigationHarness.js
 *
 * These exercise the contract's state rules — clamping, index boundaries, snap
 * stops, selection staleness and the configured route order. React rendering,
 * DOM docking and the navigate guard are lifecycle behavior verified in the
 * integrated browser run, not here.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  clampProgress,
  indexToProgress,
  planetIdAtProgress,
  progressToIndex,
} from "./homeProgress";
import { resolveSelection, retainSelection } from "./homeSelection";
import {
  getPlanetDestination,
  PLANET_DESTINATIONS,
  PLANET_ORDER,
} from "./planetDestinations";
import { UNIVERSE_HOME_V1_ENABLED } from "./homeMode";

const N = PLANET_ORDER.length;

test("clampProgress bounds every reported value to [0,1]", () => {
  assert.equal(clampProgress(0.37), 0.37);
  assert.equal(clampProgress(-0.5), 0);
  assert.equal(clampProgress(1.5), 1);
  assert.equal(clampProgress(0), 0);
  assert.equal(clampProgress(1), 1);
});

test("clampProgress resolves unmeasured input to the start", () => {
  assert.equal(clampProgress(Number.NaN), 0);
  assert.equal(clampProgress(-Infinity), 0);
  assert.equal(clampProgress(Infinity), 1);
});

test("progressToIndex picks the nearest destination at the resting stops", () => {
  assert.equal(progressToIndex(0, N), 0);
  assert.equal(progressToIndex(0.5, N), 1);
  assert.equal(progressToIndex(1, N), 2);
});

test("progressToIndex switches active planet at the midpoints", () => {
  assert.equal(progressToIndex(0.2499, N), 0);
  assert.equal(progressToIndex(0.25, N), 1);
  assert.equal(progressToIndex(0.7499, N), 1);
  assert.equal(progressToIndex(0.75, N), 2);
});

test("progressToIndex clamps out-of-range progress instead of overflowing", () => {
  assert.equal(progressToIndex(-3, N), 0);
  assert.equal(progressToIndex(9, N), N - 1);
  assert.equal(progressToIndex(Number.NaN, N), 0);
});

test("progressToIndex guards a track of one or zero destinations", () => {
  assert.equal(progressToIndex(0.9, 1), 0);
  assert.equal(progressToIndex(0.9, 0), 0);
});

test("indexToProgress returns the i/(N-1) snap stops", () => {
  assert.equal(indexToProgress(0, N), 0);
  assert.equal(indexToProgress(1, N), 0.5);
  assert.equal(indexToProgress(2, N), 1);
});

test("indexToProgress clamps an out-of-range index and guards N<=1", () => {
  assert.equal(indexToProgress(-2, N), 0);
  assert.equal(indexToProgress(99, N), 1);
  assert.equal(indexToProgress(5, 1), 0);
});

test("index and progress round-trip through every stop", () => {
  for (let i = 0; i < N; i += 1)
    assert.equal(progressToIndex(indexToProgress(i, N), N), i);
});

test("planetIdAtProgress names the planet the track is resting on", () => {
  assert.equal(planetIdAtProgress(0), "earth");
  assert.equal(planetIdAtProgress(0.5), "mars");
  assert.equal(planetIdAtProgress(1), "saturn");
});

test("a recorded choice survives on the route it was made on", () => {
  const selection = { id: "mars", route: "/" } as const;
  assert.equal(resolveSelection(selection, "/"), "mars");
});

test("a recorded choice reads as cleared once navigation settles elsewhere", () => {
  const selection = { id: "mars", route: "/" } as const;
  assert.equal(resolveSelection(selection, "/groups"), null);
  assert.equal(resolveSelection(null, "/"), null);
});

test("a recorded choice is dropped when another destination becomes active", () => {
  const selection = { id: "mars", route: "/" } as const;
  assert.equal(retainSelection(selection, "saturn"), null);
  assert.equal(retainSelection(null, "earth"), null);
});

test("a recorded choice is kept by identity while it stays active", () => {
  const selection = { id: "mars", route: "/" } as const;
  // Same reference, so the provider's state update bails out instead of
  // re-rendering every consumer on each index change.
  assert.equal(retainSelection(selection, "mars"), selection);
});

test("scrubbing the whole track only changes active at index boundaries", () => {
  // Mirrors reportHomeProgress: the ref moves every tick, React state does not.
  let index = 0;
  let commits = 0;
  for (let tick = 0; tick <= 100; tick += 1) {
    const next = progressToIndex(clampProgress(tick / 100), N);
    if (next !== index) {
      index = next;
      commits += 1;
    }
  }
  assert.equal(commits, N - 1);
  assert.equal(index, N - 1);
});

test("destinations are configured Earth -> Mars -> Saturn with v1 routes", () => {
  assert.deepEqual(
    PLANET_DESTINATIONS.map(({ id, href }) => [id, href]),
    [
      ["earth", "/posts"],
      ["mars", "/groups"],
      ["saturn", "/profile"],
    ],
  );
});

test("PLANET_ORDER is derived from the destination configuration", () => {
  assert.deepEqual(PLANET_ORDER, ["earth", "mars", "saturn"]);
  assert.equal(PLANET_ORDER.length, PLANET_DESTINATIONS.length);
  assert.equal(new Set(PLANET_ORDER).size, PLANET_ORDER.length);
});

test("the Moon is not a destination and no route is configured twice", () => {
  const hrefs = PLANET_DESTINATIONS.map((entry) => entry.href);
  assert.ok(!PLANET_ORDER.includes("moon" as never));
  assert.ok(!hrefs.includes("/moon"));
  assert.equal(new Set(hrefs).size, hrefs.length);
});

test("every destination carries the UI strings consumers render", () => {
  for (const destination of PLANET_DESTINATIONS) {
    assert.ok(destination.label.length > 0);
    assert.ok(destination.sectionLabel.length > 0);
    assert.ok(destination.href.startsWith("/"));
    assert.equal(getPlanetDestination(destination.id), destination);
  }
});

test("getPlanetDestination rejects an unconfigured id", () => {
  assert.throws(() => getPlanetDestination("moon" as never), /moon/);
});

test("the v1 mode guard is a constant, so both directions behave alike", () => {
  // A flag set only after visiting Home would leave a direct /groups entry on
  // the legacy cinematic path; the contract requires one static answer.
  assert.equal(UNIVERSE_HOME_V1_ENABLED, true);
});
