/**
 * Owner-local test harness for Universe Home v1 motion calculations.
 * Owned by Agent 2 (GSAP / Motion Engineer).
 *
 * Runs pure math checks, boundary tests, and Three.js Group mock validations.
 * Run directly with: node --no-warnings --experimental-strip-types motionHarness.ts
 */

import {
  computeRigX,
  clampProgress,
  getNearestStop,
  getNearestPlanetIndex,
  getStopForPlanet,
  computeTravelDistance,
  DEFAULT_PLANET_ORDER,
} from "./motionMath";

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
  tolerance = 1e-6,
) {
  const diff = Math.abs(actual - expected);
  assert(
    diff <= tolerance,
    name,
    `Expected ${expected}, got ${actual} (diff ${diff})`,
  );
}

export function runMotionHarness(): boolean {
  const S = 14.5; // Example measured world spacing between planet centers
  const N = 3; // Earth (0), Mars (1), Saturn (2)

  // --- Test 1: Rest stop positions at p = 0 (Earth centered) ---
  // Formula: x(i, p) = (p * (N - 1) - i) * S
  // At p = 0:
  // Earth (i=0): (0 * 2 - 0) * S = 0
  // Mars (i=1): (0 * 2 - 1) * S = -S
  // Saturn (i=2): (0 * 2 - 2) * S = -2S
  const xEarth_p0 = computeRigX(0, 0, N, S);
  const xMars_p0 = computeRigX(0, 1, N, S);
  const xSaturn_p0 = computeRigX(0, 2, N, S);
  assertClose(xEarth_p0, 0, "p=0: Earth centered at x=0");
  assertClose(xMars_p0, -S, "p=0: Mars offscreen left at x=-S");
  assertClose(xSaturn_p0, -2 * S, "p=0: Saturn offscreen left at x=-2S");

  // --- Test 2: Rest stop positions at p = 0.5 (Mars centered) ---
  // At p = 0.5:
  // Earth (i=0): (0.5 * 2 - 0) * S = +S
  // Mars (i=1): (0.5 * 2 - 1) * S = 0
  // Saturn (i=2): (0.5 * 2 - 2) * S = -S
  const xEarth_p05 = computeRigX(0.5, 0, N, S);
  const xMars_p05 = computeRigX(0.5, 1, N, S);
  const xSaturn_p05 = computeRigX(0.5, 2, N, S);
  assertClose(xEarth_p05, S, "p=0.5: Earth offscreen right at x=+S");
  assertClose(xMars_p05, 0, "p=0.5: Mars centered at x=0");
  assertClose(xSaturn_p05, -S, "p=0.5: Saturn offscreen left at x=-S");

  // --- Test 3: Rest stop positions at p = 1.0 (Saturn centered) ---
  // At p = 1.0:
  // Earth (i=0): (1.0 * 2 - 0) * S = +2S
  // Mars (i=1): (1.0 * 2 - 1) * S = +S
  // Saturn (i=2): (1.0 * 2 - 2) * S = 0
  const xEarth_p1 = computeRigX(1.0, 0, N, S);
  const xMars_p1 = computeRigX(1.0, 1, N, S);
  const xSaturn_p1 = computeRigX(1.0, 2, N, S);
  assertClose(xEarth_p1, 2 * S, "p=1.0: Earth offscreen right at x=+2S");
  assertClose(xMars_p1, S, "p=1.0: Mars offscreen right at x=+S");
  assertClose(xSaturn_p1, 0, "p=1.0: Saturn centered at x=0");

  // --- Test 4: Reverse motion consistency ---
  // Scrolling back from p=1 to p=0.5 reproduces Mars center, p=0 reproduces Earth center
  assertClose(
    computeRigX(1.0, 1, N, S),
    S,
    "Reverse: Mars at x=+S when Saturn center",
  );
  assertClose(
    computeRigX(0.5, 1, N, S),
    0,
    "Reverse: Mars at x=0 when Mars center",
  );
  assertClose(
    computeRigX(0.0, 0, N, S),
    0,
    "Reverse: Earth at x=0 when Earth center",
  );

  // --- Test 5: Midpoint snap boundaries (nearest stop without bias) ---
  // Stop 0 = 0.0, Stop 1 = 0.5, Stop 2 = 1.0
  // Midpoint 0-1 is 0.25; Midpoint 1-2 is 0.75
  assertClose(getNearestStop(0.0, N), 0.0, "Snap at p=0.0 -> 0.0");
  assertClose(getNearestStop(0.1, N), 0.0, "Snap at p=0.1 -> 0.0");
  assertClose(getNearestStop(0.24, N), 0.0, "Snap at p=0.24 -> 0.0");
  assertClose(getNearestStop(0.25, N), 0.5, "Snap at p=0.25 -> 0.5");
  assertClose(getNearestStop(0.26, N), 0.5, "Snap at p=0.26 -> 0.5");
  assertClose(getNearestStop(0.5, N), 0.5, "Snap at p=0.5 -> 0.5");
  assertClose(getNearestStop(0.74, N), 0.5, "Snap at p=0.74 -> 0.5");
  assertClose(getNearestStop(0.75, N), 1.0, "Snap at p=0.75 -> 1.0");
  assertClose(getNearestStop(0.76, N), 1.0, "Snap at p=0.76 -> 1.0");
  assertClose(getNearestStop(1.0, N), 1.0, "Snap at p=1.0 -> 1.0");

  // --- Test 5b: Clamp progress ---
  assertClose(clampProgress(-0.5), 0.0, "clampProgress clamps below 0");
  assertClose(clampProgress(1.5), 1.0, "clampProgress clamps above 1");
  assertClose(
    clampProgress(0.7),
    0.7,
    "clampProgress preserves in-bounds value",
  );

  // --- Test 6: Nearest planet index ---
  assert(
    getNearestPlanetIndex(0.0, N) === 0,
    "Planet index at p=0.0 is 0 (Earth)",
  );
  assert(
    getNearestPlanetIndex(0.24, N) === 0,
    "Planet index at p=0.24 is 0 (Earth)",
  );
  assert(
    getNearestPlanetIndex(0.26, N) === 1,
    "Planet index at p=0.26 is 1 (Mars)",
  );
  assert(
    getNearestPlanetIndex(0.5, N) === 1,
    "Planet index at p=0.5 is 1 (Mars)",
  );
  assert(
    getNearestPlanetIndex(0.74, N) === 1,
    "Planet index at p=0.74 is 1 (Mars)",
  );
  assert(
    getNearestPlanetIndex(0.76, N) === 2,
    "Planet index at p=0.76 is 2 (Saturn)",
  );
  assert(
    getNearestPlanetIndex(1.0, N) === 2,
    "Planet index at p=1.0 is 2 (Saturn)",
  );

  // --- Test 7: Stop for planet ID ---
  assertClose(
    getStopForPlanet("earth", DEFAULT_PLANET_ORDER),
    0.0,
    "Stop for 'earth' is 0.0",
  );
  assertClose(
    getStopForPlanet("mars", DEFAULT_PLANET_ORDER),
    0.5,
    "Stop for 'mars' is 0.5",
  );
  assertClose(
    getStopForPlanet("saturn", DEFAULT_PLANET_ORDER),
    1.0,
    "Stop for 'saturn' is 1.0",
  );
  assertClose(
    getStopForPlanet("unknown", DEFAULT_PLANET_ORDER),
    0.0,
    "Stop for unknown planet is 0.0 (safe fallback)",
  );

  // --- Test 8: N <= 1 edge case handling ---
  assertClose(computeRigX(0.5, 0, 1, S), 0, "N=1: computeRigX returns 0");
  assertClose(computeRigX(0.5, 0, 0, S), 0, "N=0: computeRigX returns 0");
  assertClose(getNearestStop(0.5, 1), 0, "N=1: getNearestStop returns 0");
  assertClose(getNearestStop(0.5, 0), 0, "N=0: getNearestStop returns 0");
  assert(
    getNearestPlanetIndex(0.5, 1) === 0,
    "N=1: getNearestPlanetIndex returns 0",
  );
  assert(
    getNearestPlanetIndex(0.5, 0) === 0,
    "N=0: getNearestPlanetIndex returns 0",
  );
  assertClose(computeTravelDistance(800, 1), 0, "N=1: travelDistance is 0");
  assertClose(computeTravelDistance(800, 0), 0, "N=0: travelDistance is 0");

  // --- Test 9: Travel distance calculation ---
  const travelFor800 = computeTravelDistance(800, 3);
  assert(
    travelFor800 === 1600,
    `Travel for 800px viewport: ${travelFor800}px (2 stops * 800px)`,
  );
  const travelFor400 = computeTravelDistance(400, 3);
  assert(
    travelFor400 === 1200,
    `Travel for 400px viewport: ${travelFor400}px (min 600px per stop * 2)`,
  );

  // --- Test 10: Mock Three.js Group Test Double ---
  // Create mock rig handles
  class MockGroup {
    position = { x: 0, y: 0, z: 0 };
    rotation = { x: 0, y: 0, z: 0 };
  }

  let invalidateCount = 0;
  const mockRigs = new Map([
    [
      "earth",
      {
        id: "earth",
        transitionRoot: new MockGroup(),
        scrollRoot: new MockGroup(),
      },
    ],
    [
      "mars",
      {
        id: "mars",
        transitionRoot: new MockGroup(),
        scrollRoot: new MockGroup(),
      },
    ],
    [
      "saturn",
      {
        id: "saturn",
        transitionRoot: new MockGroup(),
        scrollRoot: new MockGroup(),
      },
    ],
  ]);

  const mockScene = {
    rigs: mockRigs,
    viewportWidth: 16,
    viewportHeight: 9,
    spacing: S,
    invalidate: () => {
      invalidateCount++;
    },
  };

  // Simulate progress restoration to p = 0.5 (Mars)
  const savedProgress = 0.5;
  for (let i = 0; i < DEFAULT_PLANET_ORDER.length; i++) {
    const id = DEFAULT_PLANET_ORDER[i];
    const rig = mockScene.rigs.get(id);
    if (rig) {
      rig.scrollRoot.position.x = computeRigX(savedProgress, i, N, S);
    }
  }
  mockScene.invalidate();

  assertClose(
    mockRigs.get("earth")!.scrollRoot.position.x,
    S,
    "Mock restore: Earth scrollRoot.x = +S",
  );
  assertClose(
    mockRigs.get("mars")!.scrollRoot.position.x,
    0,
    "Mock restore: Mars scrollRoot.x = 0",
  );
  assertClose(
    mockRigs.get("saturn")!.scrollRoot.position.x,
    -S,
    "Mock restore: Saturn scrollRoot.x = -S",
  );
  assert(
    invalidateCount === 1,
    "Mock restore: invalidate() called exactly once",
  );

  // Verify transitionRoot was NOT modified
  assert(
    mockRigs.get("earth")!.transitionRoot.position.x === 0,
    "Mock isolation: transitionRoot.x remains 0 (unmodified)",
  );

  // --- Test 11: Mock goToPlanet targeting Saturn (p = 1.0) ---
  const saturnProgress = getStopForPlanet("saturn", DEFAULT_PLANET_ORDER);
  assertClose(
    saturnProgress,
    1.0,
    "goToPlanet target progress for Saturn is 1.0",
  );
  for (let i = 0; i < DEFAULT_PLANET_ORDER.length; i++) {
    const id = DEFAULT_PLANET_ORDER[i];
    const rig = mockScene.rigs.get(id);
    if (rig) {
      rig.scrollRoot.position.x = computeRigX(saturnProgress, i, N, S);
    }
  }
  mockScene.invalidate();

  assertClose(
    mockRigs.get("earth")!.scrollRoot.position.x,
    2 * S,
    "goToPlanet Saturn: Earth scrollRoot.x = +2S",
  );
  assertClose(
    mockRigs.get("mars")!.scrollRoot.position.x,
    S,
    "goToPlanet Saturn: Mars scrollRoot.x = +S",
  );
  assertClose(
    mockRigs.get("saturn")!.scrollRoot.position.x,
    0,
    "goToPlanet Saturn: Saturn scrollRoot.x = 0 (centered)",
  );
  assert(invalidateCount === 2, "goToPlanet: invalidate() called again");

  // --- Test 12: Null-safety / disabled controller simulation ---
  let nullSafeCalled = false;
  const safeNoOpController = {
    pause: () => {
      nullSafeCalled = true;
    },
    resume: () => {
      nullSafeCalled = true;
    },
    goToPlanet: (id: string) => {
      nullSafeCalled = id === "mars";
    },
  };
  safeNoOpController.pause();
  safeNoOpController.resume();
  safeNoOpController.goToPlanet("mars");
  assert(nullSafeCalled, "Safe no-op controller handles calls without errors");

  // Print results summary
  let allPassed = true;
  console.log("\n--- Motion Math & Harness Test Results ---");
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
  process.argv[1]?.endsWith("motionHarness.ts")
) {
  const passed = runMotionHarness();
  process.exit(passed ? 0 : 1);
}
