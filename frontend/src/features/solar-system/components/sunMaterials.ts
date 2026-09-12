import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  FrontSide,
  Material,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  SRGBColorSpace,
} from "three";

/** Warm white, a little cooler than the model's own plasma map so the star does
 * not read as orange. */
const CORONA_COLOR = new Color("#ffe6c4");

/**
 * The limb glow.
 *
 * The export ships a transmission shell around the core — physically the right
 * idea, and the one material in the whole scene that would cost a second render
 * pass of everything every frame. It is replaced here by a Fresnel rim, which
 * is what that shell was there to suggest: brightest where the surface turns
 * away from the eye, invisible face-on, additive over the black behind it.
 */
export function createCoronaMaterial(): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms: {
      coronaColor: { value: CORONA_COLOR },
      coronaStrength: { value: 0.42 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vSunNormal;
      varying vec3 vSunView;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vSunNormal = normalize(normalMatrix * normal);
        vSunView = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 coronaColor;
      uniform float coronaStrength;
      varying vec3 vSunNormal;
      varying vec3 vSunView;
      void main() {
        float facing = clamp(dot(normalize(vSunNormal), normalize(vSunView)), 0.0, 1.0);
        // A high exponent keeps the glow to the limb; a low one would inflate
        // the whole disc and wash the granulation out.
        float rim = pow(1.0 - facing, 3.2);
        gl_FragColor = vec4(coronaColor * rim * coronaStrength, rim * coronaStrength);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: FrontSide,
    toneMapped: false,
  });
  material.name = "Sun / limb corona";
  return material;
}

/**
 * The halo around the star, drawn on a billboard.
 *
 * Almost all of the gradient's energy sits inside the first third of the quad,
 * so the visible halo is far tighter than the sprite it lives on. That is the
 * whole trick: a wide quad with a steep falloff reads as a star seen through a
 * lens, where a wide *bright* one would read as fog and flatten the planets it
 * sits behind.
 */
export function createGlowTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Sun glow needs a 2D canvas context.");
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  // The disc covers the first third of the quad, so the ramp peaks just inside
  // its limb and is almost spent by half way out: the halo hugs the star, and
  // what is left past that is a tail too faint to lift the black behind it.
  gradient.addColorStop(0, "rgba(255, 246, 228, 0.16)");
  gradient.addColorStop(0.18, "rgba(255, 238, 200, 0.2)");
  gradient.addColorStop(0.3, "rgba(255, 214, 156, 0.2)");
  gradient.addColorStop(0.42, "rgba(255, 186, 116, 0.1)");
  gradient.addColorStop(0.65, "rgba(255, 160, 92, 0.028)");
  gradient.addColorStop(1, "rgba(255, 150, 80, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A star is not lit by anything, so its surface is driven entirely from its
 * own emissive map. Returns the disposer for the materials it creates. */
export function applySunMaterials(root: Mesh[]): () => void {
  const created: Material[] = [];
  for (const mesh of root) {
    const source = mesh.material;
    if (Array.isArray(source)) continue;
    const transmissive =
      "transmission" in source &&
      (source as { transmission: number }).transmission > 0;
    if (transmissive) {
      const corona = createCoronaMaterial();
      mesh.material = corona;
      created.push(corona);
      continue;
    }
    if (!(source instanceof MeshStandardMaterial)) continue;
    const core = source.clone();
    core.name = "Sun / plasma surface";
    // The export already carries the granulation as an emissive map; driving it
    // well past one is what makes the surface read as a light source rather than
    // as a beige sphere sitting in shadow.
    core.emissiveIntensity = 2.4;
    // Left inside tone mapping on purpose. The export's map is a saturated
    // orange, and the filmic curve is what turns that into a star: values over
    // one roll off towards white, so the disc reads as a hot core with a warm
    // limb instead of as a flat orange ball.
    core.toneMapped = true;
    mesh.material = core;
    created.push(core);
  }
  return () => {
    for (const material of created) material.dispose();
  };
}
