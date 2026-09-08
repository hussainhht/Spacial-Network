// Deterministic star field generator for Home space background.
// Uses a seeded PRNG so coordinates are identical across SSR and CSR.

export interface StarPoint {
  id: string;
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  color: string;
  group: "static" | "twinkleA" | "twinkleB" | "twinkleC" | "pulse";
  hasSpike?: boolean;
}

function createPrng(seed: number) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function inReadingZone(x: number, y: number): boolean {
  // Center orbital zone where post cards and reading focus reside
  return x >= 310 && x <= 660 && y >= 240 && y <= 760;
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
  ];

  const mediumPalette = ["#f8fafc", "#e2e8f0", "#c7d2fe", "#bfdbfe", "#fef3c7"];

  const brightPalette = ["#ffffff", "#f8fafc", "#e0e7ff", "#fef9c3"];

  // Layer 1: Extremely distant stars (~380 stars)
  const distantStars: StarPoint[] = [];
  let attempts = 0;
  while (distantStars.length < 380 && attempts < 1500) {
    attempts++;
    const cx = Math.round(rand() * 1000 * 10) / 10;
    const cy = Math.round(rand() * 1000 * 10) / 10;

    // Heavily thin out in the reading zone to keep posts readable
    if (inReadingZone(cx, cy) && rand() > 0.15) {
      continue;
    }

    const r = Math.round((0.45 + rand() * 0.45) * 100) / 100;
    const opacity = Math.round((0.15 + rand() * 0.28) * 100) / 100;
    const color = distantPalette[Math.floor(rand() * distantPalette.length)];

    // 72% static, 16% twinkleA, 12% twinkleB
    const twRoll = rand();
    let group: StarPoint["group"] = "static";
    if (twRoll < 0.16) group = "twinkleA";
    else if (twRoll < 0.28) group = "twinkleB";

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

  // Layer 2: Medium distant stars (~115 stars)
  const mediumStars: StarPoint[] = [];
  attempts = 0;
  while (mediumStars.length < 115 && attempts < 1000) {
    attempts++;
    const cx = Math.round(rand() * 1000 * 10) / 10;
    const cy = Math.round(rand() * 1000 * 10) / 10;

    // Reject 90% of medium stars in the reading zone
    if (inReadingZone(cx, cy) && rand() > 0.08) {
      continue;
    }

    const r = Math.round((1.0 + rand() * 0.6) * 100) / 100;
    const opacity = Math.round((0.26 + rand() * 0.38) * 100) / 100;
    const color = mediumPalette[Math.floor(rand() * mediumPalette.length)];

    // 64% static, 14% twinkleA, 12% twinkleB, 10% twinkleC
    const twRoll = rand();
    let group: StarPoint["group"] = "static";
    if (twRoll < 0.14) group = "twinkleA";
    else if (twRoll < 0.26) group = "twinkleB";
    else if (twRoll < 0.36) group = "twinkleC";

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

  // Layer 3: Bright focal stars (18 stars placed in aesthetic outer zones)
  const brightPositions: Array<{ x: number; y: number; spike?: boolean }> = [
    // Top-left constellation / framing
    { x: 74, y: 92, spike: true },
    { x: 142, y: 68 },
    { x: 218, y: 135 },
    { x: 95, y: 220 },
    { x: 285, y: 84 },
    { x: 180, y: 310 },
    // Upper perimeter
    { x: 440, y: 72 },
    { x: 710, y: 110, spike: true },
    { x: 880, y: 86 },
    { x: 935, y: 165 },
    // Bottom-left corner / gaps
    { x: 82, y: 780 },
    { x: 154, y: 865, spike: true },
    { x: 245, y: 715 },
    { x: 190, y: 925 },
    // Earth perimeter highlights (peeking near Earth's limb)
    { x: 670, y: 615 },
    { x: 645, y: 740 },
    { x: 480, y: 910 },
    { x: 840, y: 390 },
  ];

  const brightStars: StarPoint[] = brightPositions.map((pos, idx) => {
    const r = Math.round((1.75 + rand() * 0.5) * 100) / 100;
    const opacity = Math.round((0.68 + rand() * 0.2) * 100) / 100;
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
