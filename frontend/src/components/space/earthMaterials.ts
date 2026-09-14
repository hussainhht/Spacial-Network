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
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(mix(earthHash(i), earthHash(i + vec3(1,0,0)), f.x),
                 mix(earthHash(i + vec3(0,1,0)), earthHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(earthHash(i + vec3(0,0,1)), earthHash(i + vec3(1,0,1)), f.x),
                 mix(earthHash(i + vec3(0,1,1)), earthHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float earthFilteredNoise(vec3 p) {
  // Fade subpixel detail to its mean to prevent shimmer when zoomed out.
  float footprint = max(length(dFdx(p)), length(dFdy(p)));
  return mix(earthNoise(p), 0.5, smoothstep(0.35, 0.9, footprint));
}
float earthFbm(vec3 p) {
  float value = 0.0, weight = 0.5;
  // Rotate successive octaves so the underlying lattice is less apparent.
  const mat3 octaveRotation = mat3(
     0.00,  0.80,  0.60,
    -0.80,  0.36, -0.48,
    -0.60, -0.48,  0.64
  );
  for (int i = 0; i < 4; i++) {
    value += weight * earthFilteredNoise(p);
    p = octaveRotation * p * 2.03 + vec3(7.1, 3.7, 1.9);
    weight *= 0.5;
  }
  return value / 0.9375;
}
`;

const sphereVertexDeclarations = /* glsl */ `
#include <common>
varying vec3 vEarthPosition;
`;

const sphereVertexPosition = /* glsl */ `
#include <begin_vertex>
vEarthPosition = normalize(position);
`;

const earthFragmentDeclarations = /* glsl */ `
#include <common>
varying vec3 vEarthPosition;
uniform vec3 earthSunDirection;
${noise}
`;

const earthIndirectLighting = /* glsl */ `
#include <lights_fragment_end>
// Keep direct PBR lighting intact; reduce ambient fill gently across dusk.
// Both vectors are in view space, including when the globe or camera rotates.
vec3 earthSunView = normalize(mat3(viewMatrix) * earthSunDirection);
float earthDaylight = smoothstep(-0.18, 0.24, dot(nonPerturbedNormal, earthSunView));
reflectedLight.indirectDiffuse *= mix(0.38, 1.0, earthDaylight);
`;

/** Preserve the source map's UV transform and sampler; only reinterpret color.
 * Standard materials retain Three.js lighting, tone mapping and color management.
 */
export function createEarthMaterials(map: Texture) {
  const sunDirection = new Vector3(...SUN_POSITION).normalize();
  const surface = new MeshStandardMaterial({
    map,
    roughness: 0.8,
    metalness: 0,
  });
  surface.name = "Earth / natural land, ocean and ice";
  surface.onBeforeCompile = (shader) => {
    shader.uniforms.earthSunDirection = { value: sunDirection };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", sphereVertexDeclarations)
      .replace("#include <begin_vertex>", sphereVertexPosition);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", earthFragmentDeclarations)
      .replace(
        "#include <map_fragment>",
        /* glsl */ `
        // The optimized color map has dark blue water; derive the coastline
        // mask for the existing procedural surface palette.
        vec4 sourceTexel = texture2D(map, vMapUv);
        float waterMask = 1.0 - smoothstep(0.002, 0.018, max(sourceTexel.r, sourceTexel.g));
        float landMask = 1.0 - waterMask;
        vec3 p = normalize(vEarthPosition);
        // Sine of latitude: independent of the source map's UV transform.
        float latitude = abs(p.y);
        float climateNoise = earthFbm(p * 3.8 + vec3(2.4, 0.0, 5.1));
        float terrainDetail = earthFbm(p * 28.0);
        float fineDetail = earthFilteredNoise(p * 170.0);
        float dryBelt = smoothstep(0.16, 0.38, latitude)
                     * (1.0 - smoothstep(0.55, 0.76, latitude));
        float dryness = clamp(dryBelt * 0.8 + (climateNoise - 0.5) * 0.9, 0.0, 1.0);
        float coldRegion = smoothstep(0.64, 0.92, latitude);

        // Albedos are linear, with broad blended climate rather than elevation.
        vec3 vegetation = mix(vec3(0.026, 0.055, 0.023), vec3(0.074, 0.090, 0.040), climateNoise);
        vec3 dryLand = mix(vec3(0.13, 0.115, 0.062), vec3(0.29, 0.225, 0.14), dryness);
        vec3 landColor = mix(vegetation, dryLand, smoothstep(0.18, 0.85, dryness));
        landColor = mix(landColor, vec3(0.050, 0.063, 0.056), coldRegion * 0.65);
        float rockyRegions = smoothstep(0.56, 0.78, terrainDetail) * (0.2 + coldRegion * 0.3);
        landColor = mix(landColor, vec3(0.080, 0.072, 0.059), rockyRegions);
        landColor *= 0.80 + terrainDetail * 0.40 + (fineDetail - 0.5) * 0.08;

        // Sample in transformed map space, using its actual texel dimensions.
        // This is shoreline proximity, not bathymetry; keep the tint restrained.
        vec2 coastTexel = 1.5 / vec2(textureSize(map, 0));
        float nearbyWater = 0.25 * (
          texture2D(map, vMapUv + vec2(coastTexel.x, 0.0)).r +
          texture2D(map, vMapUv - vec2(coastTexel.x, 0.0)).r +
          texture2D(map, vMapUv + vec2(0.0, coastTexel.y)).r +
          texture2D(map, vMapUv - vec2(0.0, coastTexel.y)).r
        );
        float coastMask = waterMask * (1.0 - smoothstep(0.35, 0.98, nearbyWater));
        vec3 oceanColor = mix(vec3(0.003, 0.011, 0.026), vec3(0.005, 0.020, 0.045), climateNoise);
        oceanColor = mix(oceanColor, vec3(0.009, 0.036, 0.055), coastMask * 0.38);

        // Angular latitude keeps irregularity visible near the poles, where
        // changes in the sine of latitude become very small.
        float polarLatitude = asin(clamp(latitude, 0.0, 1.0)) * (2.0 / PI);
        float iceBoundary = polarLatitude + ((climateNoise - 0.5) * 0.12
                          + (terrainDetail - 0.5) * 0.075)
                          * (1.0 - smoothstep(0.96, 1.0, polarLatitude));
        float landIce = smoothstep(0.74, 0.87, iceBoundary);
        float seaIce = smoothstep(0.87, 0.94, iceBoundary);
        float iceMask = mix(landIce, seaIce, waterMask);
        vec3 iceColor = vec3(0.60, 0.67, 0.71) * (0.94 + terrainDetail * 0.10);
        vec3 earthColor = mix(oceanColor, landColor, landMask);
        diffuseColor.rgb *= mix(earthColor, iceColor, iceMask);
        diffuseColor.a *= sourceTexel.a;
      `,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `
        #include <roughnessmap_fragment>
        float landRoughness = mix(0.79, 0.94, terrainDetail);
        float oceanRoughness = mix(0.23, 0.31, terrainDetail);
        roughnessFactor = mix(oceanRoughness, landRoughness, landMask);
        roughnessFactor = mix(roughnessFactor, 0.88, iceMask);
      `,
      )
      .replace("#include <lights_fragment_end>", earthIndirectLighting);
  };
  surface.customProgramCacheKey = () => "earth-surface-realistic-v2";

  const cloud = new MeshStandardMaterial({
    color: new Color("#eef1f4"),
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    roughness: 1,
    metalness: 0,
    side: FrontSide,
  });
  cloud.name = "Earth / procedural clouds";
  cloud.onBeforeCompile = (shader) => {
    shader.uniforms.earthSunDirection = { value: sunDirection };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", sphereVertexDeclarations)
      .replace("#include <begin_vertex>", sphereVertexPosition);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", earthFragmentDeclarations)
      .replace(
        "#include <alphamap_fragment>",
        /* glsl */ `
        #include <alphamap_fragment>
        vec3 p = normalize(vEarthPosition);
        float latitude = abs(p.y);
        vec3 warp = vec3(
          earthNoise(p * 3.1 + vec3(1.7, 9.2, 2.8)),
          earthNoise(p * 3.1 + vec3(8.3, 2.1, 5.6)),
          earthNoise(p * 3.1 + vec3(3.4, 6.8, 1.2))
        ) - 0.5;
        // Smooth zonal shear bends formations into fronts without a UV seam.
        float shear = p.y * 0.65 + warp.y * 0.45;
        mat2 windRotation = mat2(cos(shear), -sin(shear), sin(shear), cos(shear));
        vec3 weatherPosition = p;
        weatherPosition.xz = windRotation * p.xz;
        float weather = earthFbm(weatherPosition * 5.5 + warp * 1.4);
        float formations = earthFbm(weatherPosition * 27.0 + warp * 4.0);
        float wisps = earthFilteredNoise(weatherPosition * vec3(80.0, 180.0, 80.0) + warp * 6.0);
        float equatorialBelt = 1.0 - smoothstep(0.06, 0.28, latitude);
        float stormBelt = smoothstep(0.32, 0.55, latitude)
                        * (1.0 - smoothstep(0.78, 0.94, latitude));
        float weatherThreshold = 0.53 - equatorialBelt * 0.035 - stormBelt * 0.025;
        float weatherSystems = smoothstep(weatherThreshold - 0.08, weatherThreshold + 0.14, weather);
        float cloudBody = smoothstep(0.34, 0.70, formations
                        + (weather - 0.5) * 0.28 + (wisps - 0.5) * 0.18);
        float cloudDensity = weatherSystems * cloudBody;
        float thinCloud = smoothstep(0.50, 0.76, wisps) * weatherSystems * 0.13;
        // Optical depth gives dense systems solid cores and wisps soft edges.
        float cloudAlpha = 1.0 - exp(-(cloudDensity * 3.2 + thinCloud));
        diffuseColor.a *= cloudAlpha;
        diffuseColor.rgb *= mix(0.92, 1.0, cloudBody);
      `,
      )
      .replace("#include <lights_fragment_end>", earthIndirectLighting);
  };
  cloud.customProgramCacheKey = () => "earth-clouds-realistic-v2";

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
