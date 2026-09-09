import { DEV_MODELS } from "@/components/space/modelsRegistry";

// Wider final gap accommodates the full rotating ring diameter.
const PLANET_X = [-7.65, -2.75, 2.15, 7.65];
export const planets = DEV_MODELS.map((model, index) => ({
  id: model.id,
  label: model.name,
  model,
  position: [PLANET_X[index], 0, 0] as [number, number, number],
  // Larger display scales offset the slight pullback from automatic bounds fitting.
  // Earth includes a larger source atmosphere shell; Saturn leaves room for rings.
  scale: model.id === "earth" ? 3.4875 : model.id === "saturn" ? 2.925 : 2.325,
  rotationSpeed: 0.04 + index * 0.005,
}));
export type PlanetConfig = (typeof planets)[number];
