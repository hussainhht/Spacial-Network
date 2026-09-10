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
const { SCENE_CAMERA, EARTH_SYSTEM, SPIN_SPEED, MAX_FRAME_DELTA, measureSceneFraming, sceneFrameloop, isSoftwareRenderer } = require("./sceneConfig.ts");

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`);
}

async function main() {
  const emitted = [];
  const assetErrors = [];
  const onSceneReady = (handle) => emitted.push(handle);
  const onAssetError = (model) => assetErrors.push(model.id);
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
        React.createElement(UniverseScene, { renderActive, reducedMotion, onSceneReady, onAssetError })));
    });
  };
  await render();
  const initial = emitted.at(-1);
  assert.ok(initial, "Ready while all four models suspend");
  assert.deepEqual([...initial.rigs.keys()], ["earth", "mars", "saturn"]);
  assert.equal(store.getState().scene.children.filter((child) => child.name.endsWith("-TransitionRoot")).length, 3);
  assert.equal(store.getState().internal.subscribers.length, 4, "StrictMode does not duplicate frame subscriptions");

  for (const [index, rig] of [...initial.rigs.values()].entries()) {
    rig.scrollRoot.position.x = (1 - index) * initial.spacing;
  }
  const earth = initial.rigs.get("earth");
  const earthSpin = earth.scrollRoot.getObjectByName("EarthRotationRoot");
  const orbit = earth.scrollRoot.getObjectByName("MoonOrbitRoot");
  const moonSpin = earth.scrollRoot.getObjectByName("MoonRotationRoot");
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
  earth.scrollRoot.position.x += 3;
  moonSpin.getWorldPosition(moonAfter);
  close(moonAfter.x - moonBefore.x, 3, "Moon travels with Earth scroll root");
  for (const rig of initial.rigs.values()) {
    assert.deepEqual(rig.transitionRoot.position.toArray(), [0, 0, 0]);
    assert.deepEqual(rig.transitionRoot.scale.toArray(), [1, 1, 1]);
    assert.deepEqual(rig.transitionRoot.quaternion.toArray(), [0, 0, 0, 1]);
  }

  const positions = [...initial.rigs.values()].map((rig) => rig.scrollRoot.position.x);
  const emissionCount = emitted.length;
  await act(async () => { store.getState().setSize(318, 740); });
  const resized = emitted.at(-1);
  assert.equal(emitted.length, emissionCount + 1, "Resize emits one snapshot, no transient null");
  assert.equal(resized.rigs, initial.rigs, "Map and all Group identities survive resize");
  assert.notEqual(resized.spacing, initial.spacing);
  assert.deepEqual([...resized.rigs.values()].map((rig) => rig.scrollRoot.position.x), positions, "Resize never writes motion-owned x");

  const beforeLoad = emitted.length;
  await act(async () => {
    for (const [id, asset] of pending) {
      if (id !== "moon") { asset.ready = true; asset.resolve(); }
    }
  });
  assert.equal(emitted.length, beforeLoad, "Asset completion does not republish handles");
  assert.ok(earth.scrollRoot.getObjectByName("earth-loaded-model"));
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
  assert.equal(emitted.at(-1), resized, "Asset failure preserves the ready scene");
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
    const framing = measureSceneFraming(worldWidth, worldHeight);
    assert.ok(Number.isFinite(framing.spacing) && framing.spacing > 0);
    // Project conservative AABBs over their complete depth; bodies cannot clip
    // at active stops or leak in from either neighboring stop.
    for (const [x, y, z] of [
      [1.88 * framing.earthRadius, 1.025 * framing.earthRadius, 1.88 * framing.earthRadius],
      [1.05 * framing.marsScale, 1.05 * framing.marsScale, 1.05 * framing.marsScale],
      [1.1 * framing.saturnScale, 1.1 * framing.saturnScale, 1.1 * framing.saturnScale],
    ]) {
      const magnification = SCENE_CAMERA.position[2] / (SCENE_CAMERA.position[2] - z);
      assert.ok(x * magnification <= worldWidth * 0.44 + 1e-8);
      assert.ok(y * magnification <= worldHeight * 0.34 + 1e-8);
      const neighborEdge = (framing.spacing - x) * SCENE_CAMERA.position[2] / (SCENE_CAMERA.position[2] + z);
      assert.ok(neighborEdge > worldWidth / 2, "Neighbor envelopes are outside active view");
    }
    metrics.push({ pane: `${width}x${height}`, width: worldWidth.toFixed(3), height: worldHeight.toFixed(3), spacing: framing.spacing.toFixed(3), earthDiameterPx: (2 * framing.earthRadius / worldHeight * height).toFixed(0) });
  }
  assert.ok(isSoftwareRenderer("ANGLE (Google, Vulkan SwiftShader)"));
  assert.ok(isSoftwareRenderer("llvmpipe (LLVM 15.0.7)"));
  assert.equal(isSoftwareRenderer("NVIDIA GeForce"), false);
  console.log("PASS: R3F StrictMode, suspended/failed assets, transform isolation, resize, reduced motion, sleep/wake, cleanup, perspective envelope framing, software renderer detection.");
  console.table(metrics);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
