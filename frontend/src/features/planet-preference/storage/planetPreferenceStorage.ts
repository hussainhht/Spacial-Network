import { DEFAULT_MODEL_ID, SPACE_MODELS } from "../../../components/space/modelsRegistry.ts";

// Relative import with an explicit ".ts" extension (not the "@/" alias) so
// this pure module can also be loaded directly by Node for unit tests
// without a bundler — Node's native ESM resolver requires full specifiers.

export type PlanetId = string;

export const DEFAULT_PLANET_ID: PlanetId = DEFAULT_MODEL_ID;

const STORAGE_KEY = "social_network_planet_preference";
const CHANGE_EVENT = "planet-preference-change";

const VALID_PLANET_IDS = new Set(SPACE_MODELS.map((model) => model.id));

export function isValidPlanetId(value: string | null): value is PlanetId {
  return value !== null && VALID_PLANET_IDS.has(value);
}

export function readPlanetPreference(): PlanetId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isValidPlanetId(stored) ? stored : DEFAULT_PLANET_ID;
  } catch {
    return DEFAULT_PLANET_ID;
  }
}

export function writePlanetPreference(id: PlanetId): void {
  const safeId = isValidPlanetId(id) ? id : DEFAULT_PLANET_ID;
  try {
    localStorage.setItem(STORAGE_KEY, safeId);
  } catch {
    // Keep the control usable when persistent storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToPlanetPreference(listener: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}
