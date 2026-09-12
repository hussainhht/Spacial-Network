export interface DevModel {
  id: string;
  name: string;
  filename: string;
  path: string;
  format: "GLB";
  subtitle: string;
  description: string;
  defaultScale?: number;
  defaultRotation?: [number, number, number];
  boundsMargin?: number;
  triangles?: number;
}

export const EARTH_MODEL_PATH = "/models/planets/earth-final.glb";

export const DEV_MODELS: DevModel[] = [
  {
    id: "earth",
    name: "Earth",
    filename: "earth-final.glb",
    path: EARTH_MODEL_PATH,
    format: "GLB",
    subtitle: "Terran Planet",
    description: "Recolored coastline map, procedural clouds, and subtle atmospheric scattering.",
    defaultRotation: [0, 0, 0],
    boundsMargin: 1.3,
    triangles: 11520,
  },
  {
    id: "moon",
    name: "Moon",
    filename: "moon-final.glb",
    path: "/models/planets/moon-final.glb",
    format: "GLB",
    subtitle: "Lunar Satellite",
    description: "4K high-resolution lunar surface map preserving impact craters and basalt maria.",
    defaultRotation: [0, 0, 0],
    boundsMargin: 1.3,
    triangles: 179976,
  },
  {
    id: "mars",
    name: "Mars",
    filename: "mars-final.glb",
    path: "/models/planets/mars-final.glb",
    format: "GLB",
    subtitle: "Red Planet",
    description: "Martian terrain with precomputed MikkTSpace normal tangents and WebP textures.",
    defaultRotation: [0, 0, 0],
    boundsMargin: 1.3,
    triangles: 179989,
  },
  {
    id: "saturn",
    name: "Saturn",
    filename: "saturn-final.glb",
    path: "/models/planets/saturn-final.glb",
    format: "GLB",
    subtitle: "Gas Giant with Rings",
    description: "Atmospheric planet body with transparent alpha-blended ring disc.",
    defaultRotation: [0.4, 0.2, 0.1],
    boundsMargin: 1.45,
    triangles: 17021,
  },
  {
    id: "black-hole",
    name: "Black Hole",
    filename: "black-hole-final.glb",
    path: "/models/planets/black-hole-final.glb",
    format: "GLB",
    subtitle: "Singularity & Accretion Disk",
    description: "Web-optimized black hole with central event horizon, luminous photon rings, and smooth accretion disk.",
    defaultRotation: [0.35, 0.6, 0],
    boundsMargin: 1.35,
    triangles: 13357,
  },
  {
    id: "mercury",
    name: "Mercury",
    filename: "mercury-final.glb",
    path: "/models/planets/mercury-final.glb",
    format: "GLB",
    subtitle: "Smallest Planet",
    description: "Cratered rocky surface with high-resolution albedo map capturing impact basins and regolith detail.",
    defaultRotation: [0, 0, 0],
    boundsMargin: 1.3,
    triangles: 9800,
  },
  {
    id: "venus",
    name: "Venus",
    filename: "venus-final.glb",
    path: "/models/planets/venus-final.glb",
    format: "GLB",
    subtitle: "Morning Star",
    description: "Dense sulfuric cloud cover rendered with a warm, luminous atmospheric surface map.",
    defaultRotation: [0, 0, 0],
    boundsMargin: 1.3,
    triangles: 65024,
  },
  {
    id: "sun",
    name: "Sun",
    filename: "sun-final.glb",
    path: "/models/planets/sun-final.glb",
    format: "GLB",
    subtitle: "Host Star",
    description: "Emissive plasma surface with turbulent granulation texture and glowing corona shading.",
    defaultRotation: [0, 0, 0],
    boundsMargin: 1.3,
    triangles: 7936,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    filename: "jupiter-final.glb",
    path: "/models/planets/jupiter-final.glb",
    format: "GLB",
    subtitle: "Gas Giant",
    description: "Banded atmospheric surface with swirling storm systems, including the Great Red Spot.",
    defaultRotation: [0, 0, 0],
    boundsMargin: 1.3,
    triangles: 3968,
  },
  {
    id: "uranus",
    name: "Uranus",
    filename: "uranus-final.glb",
    path: "/models/planets/uranus-final.glb",
    format: "GLB",
    subtitle: "Ice Giant",
    description: "Pale cyan atmospheric surface with subtle methane haze banding.",
    defaultRotation: [0, 0, 1.7],
    boundsMargin: 1.3,
    triangles: 8072,
  },
];
