import { DEV_MODELS, type DevModel } from "@/components/space/modelsRegistry";
import type { PlanetId } from "../contracts";

function modelFor(id: string): DevModel {
  const model = DEV_MODELS.find((entry) => entry.id === id);
  if (!model) throw new Error(`Universe Home requires the canonical ${id} model.`);
  return model;
}

export const SCENE_MODELS = {
  earth: modelFor("earth"),
  moon: modelFor("moon"),
  mars: modelFor("mars"),
  saturn: modelFor("saturn"),
};

// A longer lens gives the large active body a restrained perspective. Nothing
// adjusts this camera to include the horizontal destination track.
export const SCENE_CAMERA = {
  position: [0, 0, 18] as [number, number, number],
  fov: 30,
  near: 0.1,
  far: 120,
};
export const HARDWARE_DPR: [number, number] = [1, 1.5];
export const SOFTWARE_DPR = 0.5;
export const MAX_FRAME_DELTA = 0.05;

export const SPIN_SPEED: Record<PlanetId | "moon", number> = {
  earth: 0.035,
  moon: 0.018,
  mars: 0.03,
  saturn: 0.022,
};

export const EARTH_SYSTEM = {
  // EarthPlanetModel's visible surface radius after its existing normalization.
  // This display compensation leaves its geometry and shader shells untouched.
  modelScale: 1938.6019216974796 / 1221.1297423308124,
  atmosphereRadius: 1.025,
  moonRadius: 0.18,
  orbitRadius: 1.7,
  orbitSpeed: 0.026,
  orbitPhase: -0.55,
  orbitInclination: 0.32,
};

export type SceneFraming = {
  earthRadius: number;
  marsScale: number;
  saturnScale: number;
  spacing: number;
};

/** Fit a local envelope at z=0, allowing for its closest possible depth. */
function fitEnvelope(
  halfWidth: number,
  halfHeight: number,
  envelopeX: number,
  envelopeY: number,
  envelopeZ: number,
): number {
  const distance = SCENE_CAMERA.position[2];
  return Math.min(
    halfWidth / (envelopeX + (halfWidth * envelopeZ) / distance),
    halfHeight / (envelopeY + (halfHeight * envelopeZ) / distance),
  );
}

export function measureSceneFraming(
  viewportWidth: number,
  viewportHeight: number,
): SceneFraming {
  const width = Math.max(0, viewportWidth);
  const height = Math.max(0, viewportHeight);
  // Leave vertical room for the homepage's heading and destination controls.
  const halfWidth = width * 0.44;
  const halfHeight = height * 0.34;
  const moonEnvelope = EARTH_SYSTEM.orbitRadius + EARTH_SYSTEM.moonRadius;
  const earthRadius = fitEnvelope(
    halfWidth, halfHeight, moonEnvelope,
    EARTH_SYSTEM.atmosphereRadius, moonEnvelope,
  );
  // Generic model normalization includes Saturn's full ring span. Conservative
  // radial margins cover axial rotation and the registry's static ring tilt.
  const marsScale = fitEnvelope(halfWidth, halfHeight, 1.05, 1.05, 1.05);
  const saturnScale = fitEnvelope(halfWidth, halfHeight, 1.1, 1.1, 1.1);
  const maxEnvelope = Math.max(
    earthRadius * moonEnvelope, marsScale * 1.05, saturnScale * 1.1,
  );
  // At a resting stop every other system is completely outside the pane.
  // This also leaves a gap between envelopes throughout the scroll.
  const spacing = Math.max(
    width * 0.9,
    width / 2 + maxEnvelope * (1 + width / (2 * SCENE_CAMERA.position[2])) + width * 0.08,
  );
  return { earthRadius, marsScale, saturnScale, spacing };
}

export function sceneFrameloop(renderActive: boolean, reducedMotion: boolean) {
  if (!renderActive) return "never";
  return reducedMotion ? "demand" : "always";
}

export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|lavapipe/i.test(renderer);
}
