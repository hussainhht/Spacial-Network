// Seeded once at module load: stable across SSR, hydration and route changes.
export interface StarPoint {
  id: string;
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  color: string;
  group: "static" | "twinkleA" | "twinkleB";
}

function createPrng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function generateStars() {
  const rand = createPrng(4829104);
  const palette = ["#d6e0ed", "#becfe5", "#eef0ed", "#ddd2bf"];
  const round = (value: number) => Math.round(value * 100) / 100;

  function layer(count: number, name: string, minRadius: number, radiusRange: number, minOpacity: number, opacityRange: number) {
    return Array.from({ length: count }, (_, index): StarPoint => {
      const cx = rand() * 1000;
      // A broad, irregular diagonal population sits among uniformly scattered stars.
      // No tiled texture, grid, or repeating constellation.
      const clustered = name === "far" && rand() < 0.38;
      const cy = clustered
        ? Math.max(0, Math.min(1000, 800 - cx * 0.62 + Math.sin(cx / 155) * 45 + (rand() + rand() + rand() - 1.5) * 190))
        : rand() * 1000;
      const phase = rand();
      return {
        id: `${name}-${index}`,
        cx: round(cx),
        cy: round(cy),
        r: round(minRadius + Math.pow(rand(), 2) * radiusRange),
        opacity: round(minOpacity + rand() * opacityRange),
        color: palette[Math.floor(rand() * palette.length)],
        group: phase < 0.08 ? "twinkleA" : phase < 0.16 ? "twinkleB" : "static",
      };
    });
  }

  return {
    distantStars: layer(2100, "far", 0.22, 0.43, 0.2, 0.32),
    mediumStars: layer(180, "mid", 0.6, 0.45, 0.35, 0.3),
    brightStars: layer(16, "near", 0.95, 0.38, 0.65, 0.25),
  };
}

export const STAR_FIELD = generateStars();

// Batch the tiny stars into paths by color, brightness and animation phase.
// Thousands of points become fewer than 50 SVG nodes, without per-frame JS.
export function batchStars(stars: StarPoint[]) {
  const batches = new Map<string, { d: string; color: string; opacity: number; group: StarPoint["group"] }>();
  for (const star of stars) {
    const opacity = Math.round(star.opacity * 4) / 4;
    const key = `${star.color}-${opacity}-${star.group}`;
    const batch = batches.get(key) ?? { d: "", color: star.color, opacity, group: star.group };
    const diameter = Number((star.r * 2).toFixed(2));
    batch.d += `M${(star.cx - star.r).toFixed(2)},${star.cy}a${star.r},${star.r} 0 1,0 ${diameter},0a${star.r},${star.r} 0 1,0 -${diameter},0z`;
    batches.set(key, batch);
  }
  return [...batches.entries()].map(([id, batch]) => ({ id, ...batch }));
}
