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

// Seamless 3D noise: no UV seam or pinching at the poles. This is synthetic
// variation, not elevation data or observed weather.
const noise = /* glsl */ `
float earthHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float earthNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(earthHash(i), earthHash(i + vec3(1,0,0)), f.x),
                 mix(earthHash(i + vec3(0,1,0)), earthHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(earthHash(i + vec3(0,0,1)), earthHash(i + vec3(1,0,1)), f.x),
                 mix(earthHash(i + vec3(0,1,1)), earthHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float earthFbm(vec3 p) {
  float value = 0.0, weight = 0.5;
  for (int i = 0; i < 5; i++) {
    value += weight * earthNoise(p);
    p = p * 2.03 + vec3(7.1, 3.7, 1.9);
    weight *= 0.5;
  }
  return value;
}
`;

/** Preserve the source map's UV transform and sampler; only reinterpret color.
 * Standard materials retain Three.js lighting, tone mapping and color management.
 */
export function createEarthMaterials(map: Texture) {
  const surface = new MeshStandardMaterial({
    map,
    roughness: 0.8,
    metalness: 0,
  });
  surface.name = "Earth / recolored coastline map";
  surface.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vEarthPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvEarthPosition = normalize(position);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vEarthPosition;\n${noise}`,
      )
      .replace(
        "#include <map_fragment>",
        /* glsl */ `
        // The export is predominantly white water and black land.
        float sourceMask = texture2D(map, vMapUv).r;
        float water = smoothstep(0.15, 0.65, sourceMask);
        vec3 p = normalize(vEarthPosition);
        float detail = earthFbm(p * 38.0);
        float latitude = abs(vMapUv.y * 2.0 - 1.0);
        float dryBelt = smoothstep(0.12, 0.32, latitude)
                     * (1.0 - smoothstep(0.40, 0.65, latitude));
        float dryness = clamp(dryBelt * 0.8 + (earthFbm(p * 5.0) - 0.45), 0.0, 1.0);
        vec3 land = mix(vec3(0.035, 0.085, 0.025), vec3(0.30, 0.22, 0.105), dryness);
        land *= 0.72 + detail * 0.65;
        float shore = 1.0 - min(min(texture2D(map, vMapUv + vec2(0.001,0)).r,
                                   texture2D(map, vMapUv - vec2(0.001,0)).r),
                               min(texture2D(map, vMapUv + vec2(0,0.001)).r,
                                   texture2D(map, vMapUv - vec2(0,0.001)).r));
        vec3 ocean = mix(vec3(0.005, 0.025, 0.070), vec3(0.015, 0.10, 0.16), shore * 0.55);
        vec3 earthColor = mix(land, ocean, water);
        float ice = smoothstep(0.80, 0.94, latitude + (detail - 0.5) * 0.045);
        diffuseColor.rgb *= mix(earthColor, vec3(0.66, 0.74, 0.78), ice);
      `,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `
        #include <roughnessmap_fragment>
        roughnessFactor = mix(0.9, 0.36, water * (1.0 - ice));
      `,
      );
  };
  surface.customProgramCacheKey = () => "earth-coastline-v1";

  const cloud = new MeshStandardMaterial({
    color: new Color("#f0f4fa"),
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    roughness: 1,
    side: FrontSide,
  });
  cloud.name = "Earth / procedural clouds";
  cloud.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vEarthPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvEarthPosition = normalize(position);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vEarthPosition;\n${noise}`,
      )
      .replace(
        "#include <alphamap_fragment>",
        /* glsl */ `
        #include <alphamap_fragment>
        vec3 p = normalize(vEarthPosition);
        float warp = earthFbm(p * 4.0);
        float weather = earthFbm(p * 13.0 + vec3(warp * 2.8));
        float wisps = earthFbm(p * 65.0);
        float coverage = smoothstep(0.47, 0.68, weather + (wisps - 0.5) * 0.20);
        diffuseColor.a *= coverage;
      `,
      );
  };
  cloud.customProgramCacheKey = () => "earth-clouds-v1";

  const atmo = new ShaderMaterial({
    name: "Earth / Fresnel atmosphere",
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    blending: AdditiveBlending,
    uniforms: {
      sunDirection: { value: new Vector3(...SUN_POSITION).normalize() },
      atmosphereColor: { value: new Color("#408fce") },
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
      varying vec3 vNormalView;
      varying vec3 vPositionView;
      void main() {
        vec3 n = normalize(vNormalView);
        vec3 viewDirection = normalize(-vPositionView);
        vec3 sunView = normalize(mat3(viewMatrix) * sunDirection);
        float rim = pow(1.0 - clamp(dot(n, viewDirection), 0.0, 1.0), 4.0);
        float sunlight = smoothstep(-0.25, 0.55, dot(n, sunView));
        gl_FragColor = vec4(atmosphereColor, rim * (0.035 + sunlight * 0.38));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return { surface, cloud, atmo };
}
