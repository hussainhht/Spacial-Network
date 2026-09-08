// Deterministic star field generator for the global space background.
// Uses a seeded PRNG so coordinates and attributes are strictly identical across SSR and CSR.

export interface StarPoint {
  id: string;
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  color: string;
  group: "static" | "twinkleA" | "twinkleB" | "twinkleC" | "twinkleD" | "pulse";
  hasSpike?: boolean;
}

function createPrng(seed: number) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function generateStars(): {
  distantStars: StarPoint[];
  mediumStars: StarPoint[];
  brightStars: StarPoint[];
} {
  const rand = createPrng(4829104);

  const distantPalette = [
    "#cbd5e1",
    "#e2e8f0",
    "#94a3b8",
    "#a5b4fc",
    "#93c5fd",
    "#b0c4de",
  ];

  const mediumPalette = [
    "#f8fafc",
    "#e2e8f0",
    "#c7d2fe",
    "#bfdbfe",
    "#fef3c7",
    "#e0e7ff",
  ];

  const brightPalette = ["#ffffff", "#f8fafc", "#e0e7ff", "#fef9c3", "#e9d5ff"];

  // Layer 1: Distant tiny stars (~780 stars)
  // Distributed naturally across the full canvas with gentle organic clustering
  const distantStars: StarPoint[] = [];
  while (distantStars.length < 780) {
    const cx = Math.round(rand() * 1000 * 10) / 10;
    const cy = Math.round(rand() * 1000 * 10) / 10;

    const r = Math.round((0.45 + rand() * 0.45) * 100) / 100;
    const opacity = Math.round((0.12 + rand() * 0.26) * 100) / 100;
    const color = distantPalette[Math.floor(rand() * distantPalette.length)];

    const twRoll = rand();
    let group: StarPoint["group"] = "static";
    if (twRoll < 0.12) group = "twinkleA";
    else if (twRoll < 0.22) group = "twinkleB";
    else if (twRoll < 0.32) group = "twinkleC";

    distantStars.push({
      id: `d-${distantStars.length}`,
      cx,
      cy,
      r,
      opacity,
      color,
      group,
    });
  }

  // Layer 2: Medium distant stars (~165 stars)
  const mediumStars: StarPoint[] = [];
  while (mediumStars.length < 165) {
    const cx = Math.round(rand() * 1000 * 10) / 10;
    const cy = Math.round(rand() * 1000 * 10) / 10;

    const r = Math.round((1.05 + rand() * 0.55) * 100) / 100;
    const opacity = Math.round((0.26 + rand() * 0.32) * 100) / 100;
    const color = mediumPalette[Math.floor(rand() * mediumPalette.length)];

    const twRoll = rand();
    let group: StarPoint["group"] = "static";
    if (twRoll < 0.15) group = "twinkleA";
    else if (twRoll < 0.28) group = "twinkleB";
    else if (twRoll < 0.4) group = "twinkleD";

    mediumStars.push({
      id: `m-${mediumStars.length}`,
      cx,
      cy,
      r,
      opacity,
      color,
      group,
    });
  }

  // Layer 3: Bright focal stars (22 stars placed in natural cosmic arrangements)
  const brightPositions: Array<{ x: number; y: number; spike?: boolean }> = [
    // Top-left sector / framing
    { x: 68, y: 84, spike: true },
    { x: 142, y: 64 },
    { x: 218, y: 135 },
    { x: 95, y: 220 },
    { x: 285, y: 84 },
    { x: 180, y: 310 },
    // Top perimeter & right shoulder
    { x: 440, y: 68 },
    { x: 615, y: 92 },
    { x: 730, y: 115, spike: true },
    { x: 885, y: 86 },
    { x: 940, y: 175 },
    // Mid right & lower quadrant
    { x: 865, y: 380, spike: true },
    { x: 915, y: 560 },
    { x: 790, y: 720 },
    { x: 860, y: 870, spike: true },
    // Bottom perimeter & Earth limb highlights
    { x: 680, y: 620 },
    { x: 640, y: 760 },
    { x: 490, y: 915, spike: true },
    { x: 340, y: 890 },
    // Bottom-left corner
    { x: 82, y: 780, spike: true },
    { x: 154, y: 865 },
    { x: 245, y: 715, spike: true },
  ];

  const brightStars: StarPoint[] = brightPositions.map((pos, idx) => {
    const r = Math.round((1.75 + rand() * 0.5) * 100) / 100;
    const opacity = Math.round((0.7 + rand() * 0.22) * 100) / 100;
    const color = brightPalette[idx % brightPalette.length];
    return {
      id: `b-${idx}`,
      cx: pos.x,
      cy: pos.y,
      r,
      opacity,
      color,
      group: idx % 2 === 0 ? "pulse" : "static",
      hasSpike: pos.spike ?? false,
    };
  });

  return { distantStars, mediumStars, brightStars };
}

export const STAR_FIELD = generateStars();
