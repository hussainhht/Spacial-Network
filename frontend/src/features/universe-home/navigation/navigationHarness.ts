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
  planetIdAtPhase,
  planetIndex,
  shortestStep,
  wrapIndex,
  wrapOffset,
  wrapPhase,
} from "./planetLoop";
import { resolveSelection, retainSelection } from "./homeSelection";
import {
  getPlanetDestination,
  PLANET_DESTINATIONS,
  PLANET_ORDER,
} from "./planetDestinations";
import { UNIVERSE_HOME_V1_ENABLED } from "./homeMode";

const N = PLANET_ORDER.length;

test("wrapIndex keeps a circular list in range in both directions", () => {
  assert.equal(wrapIndex(0, N), 0);
  assert.equal(wrapIndex(N - 1, N), N - 1);
  assert.equal(wrapIndex(N, N), 0);
  assert.equal(wrapIndex(-1, N), N - 1);
  assert.equal(wrapIndex(-N - 1, N), N - 1);
  assert.equal(wrapIndex(100 * N + 2, N), 2);
});

test("wrapIndex guards an empty configuration instead of returning NaN", () => {
  assert.equal(wrapIndex(3, 0), 0);
});

test("wrapPhase folds a continuous phase into one turn", () => {
  assert.equal(wrapPhase(0, N), 0);
  assert.equal(wrapPhase(N, N), 0);
  assert.equal(wrapPhase(N + 0.25, N), 0.25);
  assert.equal(wrapPhase(-0.5, N), N - 0.5);
  assert.equal(wrapPhase(-3 * N - 1, N), N - 1);
});

test("wrapPhase resolves unmeasured input to the start", () => {
  assert.equal(wrapPhase(Number.NaN, N), 0);
  assert.equal(wrapPhase(Infinity, N), 0);
  assert.equal(wrapPhase(1, 0), 0);
});

test("wrapOffset always takes the short way round the ring", () => {
  assert.equal(wrapOffset(0, N), 0);
  assert.equal(wrapOffset(1, N), 1);
  assert.equal(wrapOffset(2, N), -1);
  assert.equal(wrapOffset(-2, N), 1);
  assert.equal(wrapOffset(N, N), 0);
});

test("shortestStep reaches every destination in one step on a ring of three", () => {
  assert.equal(shortestStep(0, 1, N), 1);
  assert.equal(shortestStep(1, 2, N), 1);
  assert.equal(shortestStep(2, 0, N), 1);
  assert.equal(shortestStep(0, 2, N), -1);
  assert.equal(shortestStep(1, 0, N), -1);
  assert.equal(shortestStep(2, 1, N), -1);
});

test("shortestStep is a no-op for the destination already in focus", () => {
  for (let i = 0; i < N; i += 1) assert.equal(shortestStep(i, i, N), 0);
});

test("shortestStep is never longer than half the ring", () => {
  for (let count = 2; count <= 9; count += 1)
    for (let from = 0; from < count; from += 1)
      for (let to = 0; to < count; to += 1)
        assert.ok(Math.abs(shortestStep(from, to, count)) <= count / 2);
});

test("planetIdAtPhase names the destination at rest, wrapping both ways", () => {
  assert.equal(planetIdAtPhase(0), "earth");
  assert.equal(planetIdAtPhase(1), "mars");
  assert.equal(planetIdAtPhase(2), "saturn");
  assert.equal(planetIdAtPhase(3), "earth");
  assert.equal(planetIdAtPhase(-1), "saturn");
  assert.equal(planetIdAtPhase(-2), "mars");
});

test("planetIndex and planetIdAtPhase round-trip through every destination", () => {
  for (const id of PLANET_ORDER)
    assert.equal(planetIdAtPhase(planetIndex(id)), id);
});

test("planetIndex rejects an unconfigured id", () => {
  assert.throws(() => planetIndex("moon" as never), /moon/);
});

test("the loop runs forever in both directions without drift", () => {
  // 40 steps each way, renormalizing after every one exactly as the loop does.
  for (const direction of [1, -1] as const) {
    let phase = 0;
    const visited: string[] = [];
    for (let step = 0; step < 40; step += 1) {
      phase = wrapPhase(phase + direction, N);
      assert.ok(phase >= 0 && phase < N);
      assert.equal(phase, Math.round(phase));
      visited.push(planetIdAtPhase(phase));
    }
    // Every destination is reached repeatedly, and the cycle never stalls.
    assert.equal(new Set(visited).size, N);
    assert.equal(phase, wrapPhase(40 * direction, N));
  }
});

test("one move commits one destination change", () => {
  // Mirrors the loop's commit: React hears about the active planet once per
  // completed timeline, not once per frame.
  let phase = 0;
  let active = planetIdAtPhase(phase);
  let commits = 0;
  for (let step = 0; step < 6; step += 1) {
    phase = wrapPhase(phase + 1, N);
    const next = planetIdAtPhase(phase);
    if (next !== active) {
      active = next;
      commits += 1;
    }
  }
  assert.equal(commits, 6);
  assert.equal(active, "earth");
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
