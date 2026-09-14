export interface SpaceModel {
  id: string;
  name: string;
  path: string;
  defaultScale?: number;
  defaultRotation?: [number, number, number];
}

export const EARTH_MODEL_PATH = "/models/planets/earth-final.glb";

// Canonical Earth identifier retained alongside the model inventory.
export const DEFAULT_MODEL_ID = "earth";

export const EARTH_MODEL: SpaceModel = {
  id: DEFAULT_MODEL_ID,
  name: "Earth",
  path: EARTH_MODEL_PATH,
  defaultRotation: [0, 0, 0],
};

export const MOON_MODEL: SpaceModel = {
  id: "moon",
  name: "Moon",
  path: "/models/planets/moon-final.glb",
  defaultRotation: [0, 0, 0],
};

export const SPACE_MODELS: SpaceModel[] = [
  EARTH_MODEL,
  MOON_MODEL,
  {
    id: "mars",
    name: "Mars",
    path: "/models/planets/mars-final.glb",
    defaultRotation: [0, 0, 0],
  },
  {
    id: "saturn",
    name: "Saturn",
    path: "/models/planets/saturn-final.glb",
    defaultRotation: [0.4, 0.2, 0.1],
  },
  {
    id: "black-hole",
    name: "Black Hole",
    path: "/models/planets/black-hole-final.glb",
    defaultRotation: [0.35, 0.6, 0],
  },
  {
    id: "mercury",
    name: "Mercury",
    path: "/models/planets/mercury-final.glb",
    defaultRotation: [0, 0, 0],
  },
  {
    id: "venus",
    name: "Venus",
    path: "/models/planets/venus-final.glb",
    defaultRotation: [0, 0, 0],
  },
  {
    id: "sun",
    name: "Sun",
    path: "/models/planets/sun-final.glb",
    defaultRotation: [0, 0, 0],
  },
  {
    id: "jupiter",
    name: "Jupiter",
    path: "/models/planets/jupiter-final.glb",
    defaultRotation: [0, 0, 0],
  },
  {
    id: "uranus",
    name: "Uranus",
    path: "/models/planets/uranus-final.glb",
    defaultRotation: [0, 0, 1.7],
  },
];

export function findSpaceModel(id: string): SpaceModel | undefined {
  return SPACE_MODELS.find((model) => model.id === id);
}
