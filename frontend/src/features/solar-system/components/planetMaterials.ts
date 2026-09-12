import {
  Color,
  Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from "three";

/** What a planet keeps of its own glow once a star is doing the lighting. Not
 * zero: a trace keeps a night side from going to absolute black, which reads as
 * a hole cut in the sky rather than as an unlit hemisphere. */
const RESIDUAL_EMISSIVE = 0.05;

/** Opacity for a shell that was refracting and now is not. Enough to keep the
 * haze the export authored, little enough that it can never hide the globe it
 * was wrapped around. */
const SHELL_OPACITY = 0.3;

/** Pale, faintly warm ice and dust. Read as a surface albedo, not as a glow:
 * the Sun still lights it, and it still has a dark side. */
const RING_COLOR = new Color("#c6b9a2");

/** How much of the sky the ring lets through at its densest. */
const RING_OPACITY = 0.62;

/** The registry's own name for Saturn's ring disc — `GenericPlanetModel` keys
 * its double-siding on the same string. */
const RING_MATERIAL = "rings";

function isTransmissive(material: Material): boolean {
  return (
    "transmission" in material &&
    (material as unknown as { transmission: number }).transmission > 0
  );
}

/**
 * Makes a body obey the scene's one light.
 *
 * Planet exports are authored to look right alone on a turntable, and three of
 * the habits that come with that are wrong in a solar system:
 *
 * - **Self-illumination.** Jupiter ships with its albedo wired to emissive at
 *   0.9, which on an inspector page reads as "evenly lit" and here reads as a
 *   planet that ignores the Sun. A body with no dark side has no place in a
 *   composition whose whole subject is one star lighting eight things.
 *
 * - **Transmission.** Uranus and the Sun both carry a refracting shell. Three
 *   renders the entire scene a second time, every frame, for any material with
 *   transmission above zero — so one decorative shell doubles the cost of the
 *   page. They become ordinary translucent shells here.
 *
 * - **Colourless ring maps.** Saturn's ring texture carries its structure in
 *   alpha and almost nothing in colour — its average texel is near black — so a
 *   correctly lit ring still comes out as a dark band across the planet.
 *
 * Materials are cloned before anything is written: `useGLTF` caches by URL and
 * the clone from `GenericPlanetModel` shares its materials with that cache, so
 * editing one in place would follow the model into every other page that loads
 * it. Returns the undo.
 */
export function sunlitOnly(root: Object3D): () => void {
  const undo: (() => void)[] = [];

  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const source = child.material;
    // Multi-material meshes do not occur in this registry; skipping one is
    // better than half-converting it.
    if (Array.isArray(source) || !(source instanceof MeshStandardMaterial))
      return;

    if (source.name === RING_MATERIAL && source.map) {
      const rings = litRings(source);
      child.material = rings;
      undo.push(() => {
        child.material = source;
        rings.dispose();
      });
      return;
    }

    const transmissive = isTransmissive(source);
    const emissive =
      source.emissiveIntensity > RESIDUAL_EMISSIVE &&
      (source.emissive.r > 0 || source.emissive.g > 0 || source.emissive.b > 0);
    if (!transmissive && !emissive) return;

    const material = source.clone();
    if (transmissive) {
      (material as unknown as { transmission: number }).transmission = 0;
      material.transparent = true;
      material.opacity = Math.min(material.opacity, SHELL_OPACITY);
      // A shell that no longer refracts must not occlude the body inside it.
      material.depthWrite = false;
    }
    if (emissive) material.emissiveIntensity = RESIDUAL_EMISSIVE;
    child.material = material;
    undo.push(() => {
      child.material = source;
      material.dispose();
    });
  });

  return () => {
    for (const restore of undo) restore();
  };
}

/**
 * Saturn's rings, lit.
 *
 * The map's alpha is the part worth keeping: it is the gaps, the Cassini
 * division and the soft falloff at both edges of the disc. Its colour is not —
 * so the shader keeps the alpha and takes the brightness from the material's
 * own colour, which the Sun then lights like any other surface. Replacing the
 * texture outright would have cost the structure; leaving it alone costs the
 * rings, which are the reason Saturn is in the composition at all.
 */
function litRings(source: MeshStandardMaterial): MeshStandardMaterial {
  const rings = source.clone();
  rings.name = "Saturn / sunlit rings";
  rings.color = RING_COLOR.clone();
  // Rings are a swarm of particles, not a plate. Holding them under full
  // opacity is what keeps the sky visible through the disc, which is the
  // difference between a ring system and a saucer.
  rings.opacity = RING_OPACITY;
  rings.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      /* glsl */ `
      diffuseColor.a *= texture2D(map, vMapUv).a;
      `,
    );
  };
  rings.customProgramCacheKey = () => "solar-system-saturn-rings";
  return rings;
}
