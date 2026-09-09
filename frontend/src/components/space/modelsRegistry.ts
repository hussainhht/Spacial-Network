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

export const DEV_MODELS: DevModel[] = [
  {
    id: "earth",
    name: "Earth",
    filename: "earth-final.glb",
    path: "/models/earth-final.glb",
    format: "GLB",
    subtitle: "Terran Planet",
    description: "Recolored coastline map, procedural clouds, and subtle atmospheric scattering.",
    defaultRotation: [0, 0, 0],
    boundsMargin: 1.3,
    triangles: 173010,
  },
  {
    id: "moon",
    name: "Moon",
    filename: "moon-final.glb",
    path: "/models/moon-final.glb",
    format: "GLB",
    subtitle: "Lunar Satellite",
    description: "4K high-resolution lunar surface map preserving impact craters and basalt maria.",
    defaultRotation: [0, 0, 0],
    boundsMargin: 1.3,
    triangles: 23232,
  },
  {
    id: "mars",
    name: "Mars",
    filename: "mars-final.glb",
    path: "/models/mars-final.glb",
    format: "GLB",
    subtitle: "Red Planet",
    description: "Martian terrain with precomputed MikkTSpace normal tangents and WebP textures.",
    defaultRotation: [0, 0, 0],
    boundsMargin: 1.3,
    triangles: 3072,
  },
  {
    id: "saturn",
    name: "Saturn",
    filename: "saturn-final.glb",
    path: "/models/saturn-final.glb",
    format: "GLB",
    subtitle: "Gas Giant with Rings",
    description: "Atmospheric planet body with dual-layer transparent alpha-blended ring disc.",
    defaultRotation: [0.4, 0.2, 0.1],
    boundsMargin: 1.45,
    triangles: 3328,
  },
];

