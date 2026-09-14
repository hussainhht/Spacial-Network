import {
  AdditiveBlending,
  Color,
  FrontSide,
  MeshStandardMaterial,
  ShaderMaterial,
  type Texture,
  Vector3,
} from "three";

export const SUN_POSITION: [number, number, number] = [-4, 2, 3];

const earthIndirectLighting = /* glsl */ `
#include <lights_fragment_end>
// Keep direct PBR lighting intact; reduce ambient fill gently across dusk.
// Both vectors are in view space, including when the globe or camera rotates.
vec3 earthSunView = normalize(mat3(viewMatrix) * earthSunDirection);
float earthDaylight = smoothstep(-0.18, 0.24, dot(nonPerturbedNormal, earthSunView));
reflectedLight.indirectDiffuse *= mix(0.38, 1.0, earthDaylight);
`;

/** Adds the day/night ambient response shared by surface and clouds. Both
 * materials otherwise render their source map's own colors unmodified.
 */
function applyDayNightLighting(material: MeshStandardMaterial, sunDirection: Vector3) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.earthSunDirection = { value: sunDirection };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `
        #include <common>
        uniform vec3 earthSunDirection;
      `,
      )
      .replace("#include <lights_fragment_end>", earthIndirectLighting);
  };
}

/** Surface and clouds render their own baked source textures as-is; only the
 * atmosphere has no baked counterpart and stays a procedural shader.
 */
export function createEarthMaterials(surfaceMap: Texture, cloudMap?: Texture) {
  const sunDirection = new Vector3(...SUN_POSITION).normalize();

  const surface = new MeshStandardMaterial({
    map: surfaceMap,
    roughness: 0.8,
    metalness: 0,
  });
  surface.name = "Earth / surface";
  applyDayNightLighting(surface, sunDirection);
  surface.customProgramCacheKey = () => "earth-surface-textured-v1";

  // Clouds are optional: models without a baked cloud layer render without one.
  let cloud: MeshStandardMaterial | undefined;
  if (cloudMap) {
    cloud = new MeshStandardMaterial({
      map: cloudMap,
      transparent: true,
      // Matches the source glTF material's baseColorFactor alpha (0.602).
      opacity: 0.602,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
      side: FrontSide,
    });
    cloud.name = "Earth / clouds";
    applyDayNightLighting(cloud, sunDirection);
    cloud.customProgramCacheKey = () => "earth-clouds-textured-v1";
  }

  const atmo = new ShaderMaterial({
    name: "Earth / thin sunlit atmosphere",
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    blending: AdditiveBlending,
    uniforms: {
      sunDirection: { value: sunDirection },
      atmosphereColor: { value: new Color("#5b91bf") },
      twilightColor: { value: new Color("#c38b6d") },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalView;
      varying vec3 vPositionView;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vPositionView = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDirection;
      uniform vec3 atmosphereColor;
      uniform vec3 twilightColor;
      varying vec3 vNormalView;
      varying vec3 vPositionView;
      void main() {
        vec3 n = normalize(vNormalView);
        vec3 viewDirection = normalize(-vPositionView);
        vec3 sunView = normalize(mat3(viewMatrix) * sunDirection);
        float viewCosine = clamp(dot(n, viewDirection), 0.0, 1.0);
        float rim = pow(1.0 - viewCosine, 5.5);
        // Fade the shell's outer boundary so it never reads as a hard outline.
        rim *= smoothstep(0.0, 0.075, viewCosine);
        float sunHeight = dot(n, sunView);
        float sunlight = smoothstep(-0.12, 0.40, sunHeight);
        float twilight = exp(-pow((sunHeight + 0.025) / 0.12, 2.0));
        vec3 scatterColor = mix(atmosphereColor, twilightColor, twilight * 0.35);
        float atmosphereAlpha = rim * (0.006 + sunlight * 0.34 + twilight * 0.055);
        gl_FragColor = vec4(scatterColor, atmosphereAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return { surface, cloud, atmo };
}
