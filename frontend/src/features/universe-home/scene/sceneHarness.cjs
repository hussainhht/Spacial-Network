/* Run from frontend: node src/features/universe-home/scene/sceneHarness.cjs
 * Uses the installed R3F reconciler with a no-GPU renderer and controlled asset
 * promises. This verifies transforms/lifecycles, not GLB materials or GPU speed.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const THREE = require("three");
const { createRoot, extend, act } = require("@react-three/fiber");

const src = path.resolve(__dirname, "../../..");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith("@/") ? path.join(src, request.slice(2)) : request, ...args);
};
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Demand invalidation can schedule a frame, but tests advance it explicitly.
let nextFrame = 0;
const scheduledFrames = new Map();
globalThis.requestAnimationFrame = (callback) => {
  scheduledFrames.set(++nextFrame, callback);
  return nextFrame;
};
globalThis.cancelAnimationFrame = (id) => scheduledFrames.delete(id);
extend(THREE);

const pending = new Map();
for (const id of ["earth", "moon", "mars", "saturn"]) {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  pending.set(id, { promise, resolve, ready: false, failed: false });
}
function AssetDouble({ id }) {
  const asset = pending.get(id);
  if (asset.failed) throw new Error(`Controlled ${id} load failure`);
  if (!asset.ready) throw asset.promise;
  return React.createElement("group", { name: `${id}-loaded-model` });
}
// Only the GLB loader/renderers are doubled; actual scene wrappers, error
// boundaries, React effects, useFrame subscriptions and Three Groups execute.
const modelPath = require.resolve(path.join(src, "components/space/DevPlanetModel.tsx"));
require.cache[modelPath] = {
  id: modelPath, filename: modelPath, loaded: true,
  exports: {
    EarthPlanetModel: () => React.createElement(AssetDouble, { id: "earth" }),
    GenericPlanetModel: ({ modelConfig }) => React.createElement(AssetDouble, { id: modelConfig.id }),
  },
};
const UniverseScene = require("./UniverseScene.tsx").default;
const { SCENE_CAMERA, EARTH_SYSTEM, SPIN_SPEED, MAX_FRAME_DELTA, SATELLITE_EMPHASIS, measureSceneFraming, sceneFrameloop, isSoftwareRenderer } = require("./sceneConfig.ts");
const { placeOnOrbit, createPlacement, orbitNearness } = require("../motion/orbitPath.ts");

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`);
}

async function main() {
  const emitted = [];
  const assetErrors = [];
  const onSceneReady = (handle) => emitted.push(handle);
  const onAssetError = (model) => assetErrors.push(model.id);
  const activated = [];
  const onPlanetActivate = (id) => activated.push(id);
  // The loop's continuous position. The scene only ever reads it.
  const phase = { current: 0 };
  const canvas = {};
  const rendererErrors = [];
  globalThis.reportError = (error) => rendererErrors.push(error);
  let draws = 0;
  const renderer = {
    render: () => { draws++; },
    setSize() {}, setPixelRatio() {},
    domElement: canvas,
    xr: { addEventListener() {}, removeEventListener() {} },
    shadowMap: {},
  };
  const root = createRoot(canvas);
  await root.configure({
    gl: renderer, camera: SCENE_CAMERA, frameloop: "never",
    size: { width: 1196, height: 836, top: 0, left: 0 },
  });
  let store;
  const render = async (renderActive = true, reducedMotion = false) => {
    await act(async () => {
      store = root.render(React.createElement(React.StrictMode, null,
        React.createElement(UniverseScene, { renderActive, reducedMotion, phase, onSceneReady, onPlanetActivate, onAssetError })));
    });
  };
  await render();
  const initial = emitted.at(-1);
  assert.ok(initial, "Ready while all four models suspend");
  assert.equal(typeof initial.invalidate, "function", "The handle carries only what the loop needs");
  const scene = store.getState().scene;
  const transitionRoots = scene.children.filter((child) => child.name.endsWith("-TransitionRoot"));
  assert.equal(transitionRoots.length, 3);
  assert.deepEqual(transitionRoots.map((root) => root.name.replace("-TransitionRoot", "")), ["earth", "mars", "saturn"]);
  assert.equal(store.getState().internal.subscribers.length, 4, "StrictMode does not duplicate frame subscriptions");

  const orbitRoot = (id) => scene.getObjectByName(`${id}-OrbitRoot`);
  // advance() takes an absolute timestamp, so frames must step forward.
  let clock = 0;
  const tick = () => store.getState().advance((clock += 0.016));
  const orbitRoots = ["earth", "mars", "saturn"].map(orbitRoot);
  assert.ok(orbitRoots.every(Boolean), "Every destination has an orbit root");

  // The rigs place themselves from the phase; nothing outside them writes x.
  tick();
  const framing = measureSceneFraming(...(() => {
    const { width, height } = store.getState().size;
    const worldHeight = 2 * SCENE_CAMERA.position[2] * Math.tan(SCENE_CAMERA.fov * Math.PI / 360);
    return [worldHeight * width / height, worldHeight, width];
  })());
  const expected = createPlacement();
  for (const [index, id] of ["earth", "mars", "saturn"].entries()) {
    placeOnOrbit(index - phase.current, 3, framing.orbit, expected);
    const root = orbitRoot(id);
    close(root.position.x, expected.x, `${id} sits at its orbit x`);
    close(root.position.z, expected.z, `${id} sits at its orbit depth`);
    close(root.scale.x, expected.scale, `${id} is drawn at its orbit scale`);
  }
  close(orbitRoot("earth").position.z, 0, "The focus rests on the measured framing plane");
  assert.ok(orbitRoot("mars").scale.x < 0.6 && orbitRoot("mars").scale.x > 0.2, "A neighbour is subordinate but present");

  // Advancing the phase moves every planet along the same closed path.
  phase.current = 1;
  tick();
  for (const [index, id] of ["earth", "mars", "saturn"].entries()) {
    placeOnOrbit(index - 1, 3, framing.orbit, expected);
    close(orbitRoot(id).position.x, expected.x, `${id} follows the phase`);
  }
  close(orbitRoot("mars").position.z, 0, "One step brings Mars to the focus");
  // Periodicity is the whole loop: a whole turn must reproduce the placement.
  const beforeTurn = ["earth", "mars", "saturn"].map((id) => orbitRoot(id).position.clone());
  phase.current = 1 + 3;
  tick();
  ["earth", "mars", "saturn"].forEach((id, index) => {
    close(orbitRoot(id).position.x, beforeTurn[index].x, `${id} is unmoved by a whole turn of phase`);
    close(orbitRoot(id).position.z, beforeTurn[index].z, `${id} keeps its depth across a whole turn`);
  });
  phase.current = 0;
  tick();

  const earth = { orbitRoot: orbitRoot("earth") };
  const earthSpin = earth.orbitRoot.getObjectByName("EarthRotationRoot");
  const orbit = earth.orbitRoot.getObjectByName("MoonOrbitRoot");
  const moonSpin = earth.orbitRoot.getObjectByName("MoonRotationRoot");
  const satellite = earth.orbitRoot.getObjectByName("MoonOrbitInclination");

  // The Moon is drawn for the subject and culled once Earth becomes a neighbour.
  assert.ok(satellite.visible, "The Moon is drawn while Earth is in focus");
  phase.current = 1;
  tick();
  assert.ok(orbitNearness(-1, 3) < SATELLITE_EMPHASIS);
  assert.equal(satellite.visible, false, "The Moon is culled once Earth recedes");
  phase.current = 0;
  tick();
  assert.ok(satellite.visible, "The Moon returns with Earth, orbit phase intact");
  assert.ok(!earthSpin.getObjectById(orbit.id), "Moon is outside Earth axial rotation");

  const spinBefore = earthSpin.rotation.y;
  const orbitBefore = orbit.rotation.y;
  store.getState().advance(10);
  close(earthSpin.rotation.y - spinBefore, MAX_FRAME_DELTA * SPIN_SPEED.earth, "Large delta is clamped for Earth spin");
  close(orbit.rotation.y - orbitBefore, MAX_FRAME_DELTA * EARTH_SYSTEM.orbitSpeed, "Independent orbit rate");
  const moonBefore = new THREE.Vector3();
  moonSpin.getWorldPosition(moonBefore);
  earthSpin.rotation.y += 1;
  const moonAfter = new THREE.Vector3();
  moonSpin.getWorldPosition(moonAfter);
  close(moonAfter.distanceTo(moonBefore), 0, "Earth spin cannot move the Moon");
  earth.orbitRoot.position.x += 3;
  moonSpin.getWorldPosition(moonAfter);
  close(moonAfter.x - moonBefore.x, 3, "Moon travels with Earth orbit root");
  earth.orbitRoot.position.x -= 3;
  for (const root of transitionRoots) {
    assert.deepEqual(root.position.toArray(), [0, 0, 0]);
    assert.deepEqual(root.scale.toArray(), [1, 1, 1]);
    assert.deepEqual(root.quaternion.toArray(), [0, 0, 0, 1]);
  }

  const identities = orbitRoots.map((root) => root.uuid);
  const emissionCount = emitted.length;
  await act(async () => { store.getState().setSize(318, 740); });
  const resized = emitted.at(-1);
  // The handle deliberately carries no measurements, so a resize re-frames the
  // scene in place. Republishing here used to tear down and rebuild the whole
  // motion layer mid-gesture, which is what made scrolling stutter.
  assert.equal(emitted.length, emissionCount, "Resize does not republish the scene handle");
  assert.equal(resized, initial, "The motion layer keeps the handle it was given");
  assert.deepEqual(["earth", "mars", "saturn"].map((id) => orbitRoot(id).uuid), identities, "Group identities survive resize");
  const narrow = measureSceneFraming(...(() => {
    const worldHeight = 2 * SCENE_CAMERA.position[2] * Math.tan(SCENE_CAMERA.fov * Math.PI / 360);
    return [worldHeight * 318 / 740, worldHeight, 318];
  })());
  // Past the clamp probe above, which leaves the clock at 10s.
  store.getState().advance(10.016);
  placeOnOrbit(0, 3, narrow.orbit, expected);
  close(orbitRoot("earth").position.x, expected.x, "Resize re-frames the orbit in place");

  const beforeLoad = emitted.length;
  await act(async () => {
    for (const [id, asset] of pending) {
      if (id !== "moon") { asset.ready = true; asset.resolve(); }
    }
  });
  assert.equal(emitted.length, beforeLoad, "Asset completion does not republish handles");
  assert.ok(earth.orbitRoot.getObjectByName("earth-loaded-model"));
  const originalError = console.error;
  const expectedErrors = [];
  console.error = (...args) => expectedErrors.push(args);
  try {
    await act(async () => {
      const moon = pending.get("moon");
      moon.failed = true;
      moon.resolve();
    });
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(assetErrors, ["moon"], "Moon failure is reported independently");
  assert.deepEqual(rendererErrors.map((error) => error.message), ["Controlled moon load failure"]);
  assert.ok(expectedErrors.length > 0);
  assert.equal(emitted.at(-1), initial, "Asset failure preserves the ready scene");
  assert.ok(store.getState().scene.getObjectByName("saturn-loaded-model"));

  await render(true, true);
  const paused = [earthSpin.rotation.y, orbit.rotation.y, moonSpin.rotation.y];
  store.getState().advance(20);
  assert.deepEqual([earthSpin.rotation.y, orbit.rotation.y, moonSpin.rotation.y], paused, "Reduced motion pauses spin/orbit");
  await render(false, false);
  store.getState().advance(30);
  assert.deepEqual([earthSpin.rotation.y, orbit.rotation.y, moonSpin.rotation.y], paused, "Off-home pauses even a forced frame");
  assert.equal(sceneFrameloop(false, false), "never");
  assert.equal(sceneFrameloop(true, true), "demand");
  assert.equal(sceneFrameloop(true, false), "always");
  const beforeInvalidation = store.getState().internal.frames;
  store.getState().invalidate();
  assert.equal(store.getState().internal.frames, beforeInvalidation, "Never mode ignores invalidation");
  const beforePauseDraws = draws;
  assert.equal(scheduledFrames.size, 0, "Sleeping renderer does not schedule RAF");
  await render();
  store.getState().advance(30.016);
  assert.ok(earthSpin.rotation.y > paused[0], "Returning Home resumes spin");
  assert.ok(draws > beforePauseDraws);
  await act(async () => { root.render(null); });
  assert.equal(emitted.at(-1), null, "Teardown publishes null");
  assert.equal(store.getState().internal.subscribers.length, 0, "Teardown removes frame subscriptions");
  // R3F's root itself is non-strict, so React 19 does not replay initial effects
  // for a nested StrictMode boundary. Exercise that teardown/remount explicitly.
  pending.get("moon").failed = false;
  pending.get("moon").ready = true;
  await render();
  assert.ok(emitted.at(-1), "Fresh mount publishes readiness after cleanup");
  assert.equal(store.getState().internal.subscribers.length, 4, "Remount has no stale subscriptions");
  await act(async () => root.unmount());
  assert.equal(emitted.at(-1), null);

  const metrics = [];
  for (const [width, height] of [[1196, 836], [524, 920], [318, 740], [146, 740], [1196, 300]]) {
    const worldHeight = 2 * SCENE_CAMERA.position[2] * Math.tan(SCENE_CAMERA.fov * Math.PI / 360);
    const worldWidth = worldHeight * width / height;
    const framing = measureSceneFraming(worldWidth, worldHeight, width);
    const focus = placeOnOrbit(0, 3, framing.orbit, createPlacement());
    const neighbour = placeOnOrbit(1, 3, framing.orbit, createPlacement());
    assert.ok(Number.isFinite(focus.x) && Number.isFinite(neighbour.x));
    // Project conservative AABBs over their complete depth. The subject must
    // stay inside the pane at its resting point, and each neighbour must be
    // both fully on screen and clearly subordinate to it.
    for (const [x, y, z] of [
      [1.88 * framing.earthRadius, 1.025 * framing.earthRadius, 1.88 * framing.earthRadius],
      [1.05 * framing.marsScale, 1.05 * framing.marsScale, 1.05 * framing.marsScale],
      [1.1 * framing.saturnScale, 1.1 * framing.saturnScale, 1.1 * framing.saturnScale],
    ]) {
      const magnify = (depth) => SCENE_CAMERA.position[2] / (SCENE_CAMERA.position[2] - depth);
      const active = magnify(focus.z);
      assert.ok(Math.abs(focus.x) + x * active <= worldWidth / 2 + 1e-8, "The subject stays inside the pane");
      assert.ok(y * active <= worldHeight * 0.34 + 1e-8, "The subject leaves room for the heading and controls");
      const far = magnify(neighbour.z) * neighbour.scale;
      assert.ok(Math.abs(neighbour.x) + x * far <= worldWidth / 2 + 1e-8, "A neighbour is fully on screen");
      assert.ok(Math.abs(neighbour.y) + y * far <= worldHeight / 2 + 1e-8, "A neighbour is fully on screen vertically");
      assert.ok(far / active < 0.6, "A neighbour never competes with the subject");
      assert.ok(far / active > 0.2, "A neighbour is still legibly a planet");
    }
    metrics.push({
      pane: `${width}x${height}`,
      width: worldWidth.toFixed(3),
      height: worldHeight.toFixed(3),
      focusX: focus.x.toFixed(2),
      neighbourXY: `${neighbour.x.toFixed(2)},${neighbour.y.toFixed(2)}`,
      neighbourScale: neighbour.scale.toFixed(3),
      earthDiameterPx: (2 * framing.earthRadius / worldHeight * height).toFixed(0),
    });
  }
  assert.ok(isSoftwareRenderer("ANGLE (Google, Vulkan SwiftShader)"));
  assert.ok(isSoftwareRenderer("llvmpipe (LLVM 15.0.7)"));
  assert.equal(isSoftwareRenderer("NVIDIA GeForce"), false);
  console.log("PASS: R3F StrictMode, suspended/failed assets, orbit placement and periodicity, satellite culling, transform isolation, resize, reduced motion, sleep/wake, cleanup, perspective envelope framing, software renderer detection.");
  console.table(metrics);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
