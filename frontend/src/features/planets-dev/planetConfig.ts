import { DEV_MODELS } from "@/components/space/modelsRegistry";

// Equal slots leave room for Saturn's rings throughout a full rotation.
export const PLANET_SPACING = 3.6;
export const planets = DEV_MODELS.map((model, index) => ({
  id: model.id,
  label: model.name,
  model,
  position: [(index - (DEV_MODELS.length - 1) / 2) * PLANET_SPACING, 0, 0] as [number, number, number],
  // Larger display scales offset the slight pullback from automatic bounds fitting.
  // Earth includes a larger source atmosphere shell; Saturn leaves room for rings.
  scale: model.id === "earth" ? 2.325 : model.id === "saturn" ? 1.95 : 1.55,
  rotationSpeed: 0.04 + index * 0.005,
}));
export type PlanetConfig = (typeof planets)[number];
