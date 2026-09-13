// Focused, framework-free tests for the planet preference layer.
// Run via `npm run test:unit` (Node's built-in test runner + native TS
// support — no jsdom/RTL needed since the storage layer has no React or
// DOM dependency beyond `localStorage`/`window`, which we stub below).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLANET_ID,
  isValidPlanetId,
  readPlanetPreference,
  writePlanetPreference,
  subscribeToPlanetPreference,
} from "../src/features/planet-preference/storage/planetPreferenceStorage.ts";
import { SPACE_MODELS, DEFAULT_MODEL_ID } from "../src/components/space/modelsRegistry.ts";

const STORAGE_KEY = "social_network_planet_preference";

class MemoryStorage {
  #data = new Map();
  getItem(key) {
    return this.#data.has(key) ? this.#data.get(key) : null;
  }
  setItem(key, value) {
    this.#data.set(key, String(value));
  }
  removeItem(key) {
    this.#data.delete(key);
  }
}

function installBrowserGlobals() {
  globalThis.localStorage = new MemoryStorage();
  globalThis.window = new EventTarget();
}

test("modelsRegistry: every id is unique and non-empty, and the default resolves to a real model", () => {
  const ids = SPACE_MODELS.map((model) => model.id);
  assert.equal(new Set(ids).size, ids.length, "model ids must be unique");
  for (const id of ids) assert.ok(id.length > 0, "model id must not be empty");
  assert.ok(ids.includes(DEFAULT_MODEL_ID), "DEFAULT_MODEL_ID must exist in SPACE_MODELS");
  assert.equal(DEFAULT_PLANET_ID, DEFAULT_MODEL_ID, "the preference default must match the registry default");
});

test("readPlanetPreference: defaults to Earth when nothing is stored", () => {
  installBrowserGlobals();
  assert.equal(readPlanetPreference(), DEFAULT_PLANET_ID);
});

test("readPlanetPreference: loads a valid saved preference", () => {
  installBrowserGlobals();
  globalThis.localStorage.setItem(STORAGE_KEY, "mars");
  assert.equal(readPlanetPreference(), "mars");
});

test("readPlanetPreference: an invalid saved value safely falls back to Earth", () => {
  installBrowserGlobals();
  globalThis.localStorage.setItem(STORAGE_KEY, "pluto");
  assert.equal(readPlanetPreference(), DEFAULT_PLANET_ID);
});

test("readPlanetPreference: falls back to Earth when storage throws", () => {
  globalThis.window = new EventTarget();
  globalThis.localStorage = {
    getItem() {
      throw new Error("storage unavailable");
    },
  };
  assert.equal(readPlanetPreference(), DEFAULT_PLANET_ID);
});

test("writePlanetPreference: changing the selection persists and is read back", () => {
  installBrowserGlobals();
  writePlanetPreference("saturn");
  assert.equal(readPlanetPreference(), "saturn");
});

test("writePlanetPreference: an invalid id is never persisted as-is", () => {
  installBrowserGlobals();
  writePlanetPreference("not-a-real-planet");
  assert.equal(readPlanetPreference(), DEFAULT_PLANET_ID);
});

test("isValidPlanetId: only accepts ids present in modelsRegistry", () => {
  assert.equal(isValidPlanetId("earth"), true);
  assert.equal(isValidPlanetId("pluto"), false);
  assert.equal(isValidPlanetId(null), false);
});

test("subscribeToPlanetPreference: notifies listeners when the selection changes", () => {
  installBrowserGlobals();
  let notified = false;
  const unsubscribe = subscribeToPlanetPreference(() => {
    notified = true;
  });
  writePlanetPreference("venus");
  assert.equal(notified, true, "changing the selection should notify subscribers");
  unsubscribe();
});
