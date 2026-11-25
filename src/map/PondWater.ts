import * as THREE from 'three';
import { POND, terrainHeight } from './ForestTerrain';

const LEVEL = -0.62;
const DEPTH_RANGE = 1.2;
const deep = new THREE.Color(0x086596);
const blue = new THREE.Color(0x0c9bc5);
const shallow = new THREE.Color(0x64d5cf);
const foamColor = new THREE.Color(0xc7f1e6);

function bakePondTexture(): THREE.DataTexture {
  const width = 160;
  const height = 136;
  const pixels = new Uint8Array(width * height * 4);
  const color = new THREE.Color();
  const srgb = new THREE.Color();
  for (let row = 0; row < height; row++) {
    const z = (1 - 2 * (row + 0.5) / height) * POND.rz;
    for (let column = 0; column < width; column++) {
      const x = (2 * (column + 0.5) / width - 1) * POND.rx;
      const depth = Math.max(0, LEVEL - terrainHeight(POND.x + x, POND.z + z));
      const swell = Math.sin(x * 1.4 + Math.sin(z * 2.2)) * 2.4;
      const crest = Math.sin(x * 2.3 + z * 11.8 + swell);
      const brokenSheen = THREE.MathUtils.smoothstep(crest, 0.66, 0.99) *
        THREE.MathUtils.smoothstep(Math.sin(x * 2.8 - z * 4.1 + swell), 0.1, 0.9) * 0.26;
      const foam = 1 - THREE.MathUtils.smoothstep(depth + crest * 0.014, 0.008, 0.052);
      color.copy(blue).lerp(deep, THREE.MathUtils.smoothstep(depth, 0.18, 1.15));
      color.lerp(shallow, 1 - THREE.MathUtils.smoothstep(depth, 0, 0.45));
      color.multiplyScalar(0.96 + crest * 0.05).lerp(foamColor, Math.min(1, foam * 0.86 + brokenSheen));
      srgb.copy(color).convertLinearToSRGB();
      const offset = (row * width + column) * 4;
      pixels[offset] = Math.round(Math.min(1, srgb.r) * 255);
      pixels[offset + 1] = Math.round(Math.min(1, srgb.g) * 255);
      pixels[offset + 2] = Math.round(Math.min(1, srgb.b) * 255);
      // Alpha stores bathymetry for the animated material. The lightweight material renders opaque.
      pixels[offset + 3] = Math.round(Math.min(1, depth / DEPTH_RANGE) * 255);
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function animatedMaterial(texture: THREE.Texture, time: { value: number }): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.29, metalness: 0.04 });
  material.onBeforeCompile = shader => {
    shader.uniforms.pondTime = time;
    shader.uniforms.pondTexture = { value: texture };
    shader.uniforms.pondDepthRange = { value: DEPTH_RANGE };
    shader.uniforms.pondDeep = { value: deep };
    shader.uniforms.pondBlue = { value: blue };
    shader.uniforms.pondShallow = { value: shallow };
    shader.uniforms.pondFoam = { value: foamColor };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec2 vPondUV;
        varying vec2 vPondPoint;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vPondUV = uv;
        vPondPoint = position.xz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float pondTime;
        uniform sampler2D pondTexture;
        uniform float pondDepthRange;
        uniform vec3 pondDeep;
        uniform vec3 pondBlue;
        uniform vec3 pondShallow;
        uniform vec3 pondFoam;
        varying vec2 vPondUV;
        varying vec2 vPondPoint;

        float pondHash(vec2 p) {
          vec3 q = fract(vec3(p.xyx) * 0.1031);
          q += dot(q, q.yzx + 33.33);
          return fract((q.x + q.y) * q.z);
        }

        float pondNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 w = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(pondHash(i), pondHash(i + vec2(1.0, 0.0)), w.x),
            mix(pondHash(i + vec2(0.0, 1.0)), pondHash(i + vec2(1.0, 1.0)), w.x),
            w.y
          );
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 point = vPondPoint;
        float t = pondTime;
        float depth = texture2D(pondTexture, vPondUV).a * pondDepthRange;
        float swell = pondNoise(point * vec2(1.4, 2.2) + vec2(t * 0.24, -t * 0.11));
        float phaseA = dot(point, vec2(2.3, 11.8)) + swell * 5.6 - t * 2.05;
        float phaseB = dot(point, vec2(5.1, -7.9)) + swell * 4.3 + t * 1.18;
        float waveA = sin(phaseA);
        float waveB = sin(phaseB);
        float flecks = pondNoise(point * vec2(14.0, 23.0) + vec2(t * 0.55, t * 0.21));
        float patches = pondNoise(point * vec2(2.8, 5.8) - vec2(t * 0.28, 0.0));
        float sheen = smoothstep(0.54, 0.96, waveA) * smoothstep(0.31, 0.70, patches);
        float glint = sheen * smoothstep(0.36, 0.82, flecks) * (0.65 + waveB * 0.35);
        vec3 waterColor = mix(pondBlue, pondDeep, smoothstep(0.18, 1.15, depth));
        waterColor = mix(pondShallow, waterColor, smoothstep(0.0, 0.45, depth));
        waterColor *= 0.88 + swell * 0.22 + waveA * 0.04;
        float edge = depth + (flecks - 0.5) * 0.022 + waveA * 0.014;
        float foam = 1.0 - smoothstep(0.008, 0.052, edge);
        float shoreRipple = (1.0 - smoothstep(0.021, 0.075, abs(edge - 0.12))) * smoothstep(0.33, 0.7, patches);
        diffuseColor.rgb = mix(waterColor, pondFoam, foam * 0.86 + shoreRipple * 0.32 + sheen * 0.11 + glint * 0.31);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 ripple = vec3(cos(phaseA) * 0.048 + cos(phaseB) * 0.041, 0.0,
          cos(phaseA) * 0.097 - cos(phaseB) * 0.036);
        normal = normalize(normal + mat3(viewMatrix) * ripple);`);
  };

  return material;
}

export class PondWater extends THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial | THREE.MeshLambertMaterial> {
  private readonly time: { value: number };
  private readonly animated: THREE.MeshStandardMaterial;
  private readonly still: THREE.MeshLambertMaterial;

  constructor() {
    const texture = bakePondTexture();
    const time = { value: 0 };
    const animated = animatedMaterial(texture, time);
    const geometry = new THREE.PlaneGeometry(POND.rx * 2, POND.rz * 2);
    geometry.rotateX(-Math.PI / 2);
    super(geometry, animated);
    this.time = time;
    this.animated = animated;
    this.still = new THREE.MeshLambertMaterial({ map: texture });
    this.name = 'Alder Pond';
    this.position.set(POND.x, LEVEL, POND.z);
    this.receiveShadow = true;
  }

  public update(elapsed: number, animated: boolean): void {
    this.material = animated ? this.animated : this.still;
    if (animated) this.time.value = elapsed;
  }
}
