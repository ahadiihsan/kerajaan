import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const TiltShiftDoFShader = {
  name: 'TiltShiftDoFShader',
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    focusY: { value: 0.50 },
    focusRange: { value: 0.28 },
    blurAmount: { value: 3.2 },
    bokehGain: { value: 1.15 },
    enabled: { value: 1.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float focusY;
    uniform float focusRange;
    uniform float blurAmount;
    uniform float bokehGain;
    uniform float enabled;
    varying vec2 vUv;

    void main() {
      if (enabled < 0.5) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      // Calculate distance from horizontal focal line
      float distFromFocus = abs(vUv.y - focusY);

      // Smooth step creates a sharp focal zone around the character with progressive blur into distance & foreground
      float blurFactor = smoothstep(focusRange * 0.45, focusRange * 1.5, distFromFocus);

      if (blurFactor <= 0.02) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec2 texel = vec2(1.0 / resolution.x, 1.0 / resolution.y);
      vec2 step = texel * (blurAmount * blurFactor);

      // 13-tap circular bokeh disc kernel for photographic depth of field
      vec4 center = texture2D(tDiffuse, vUv);
      vec4 sum = center * 0.18;
      float totalWeight = 0.18;

      vec2 samples[12];
      samples[0]  = vec2( 0.0,   1.0);
      samples[1]  = vec2( 0.866, 0.5);
      samples[2]  = vec2( 0.866,-0.5);
      samples[3]  = vec2( 0.0,  -1.0);
      samples[4]  = vec2(-0.866,-0.5);
      samples[5]  = vec2(-0.866, 0.5);
      samples[6]  = vec2( 0.0,   0.55);
      samples[7]  = vec2( 0.476, 0.275);
      samples[8]  = vec2( 0.476,-0.275);
      samples[9]  = vec2( 0.0,  -0.55);
      samples[10] = vec2(-0.476,-0.275);
      samples[11] = vec2(-0.476, 0.275);

      for (int i = 0; i < 12; i++) {
        vec2 offset = samples[i] * step;
        vec4 col = texture2D(tDiffuse, vUv + offset);
        // Subtle optical highlight expansion (bokeh pop)
        float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
        float weight = (lum > 0.72) ? (1.0 + (lum - 0.72) * 1.5 * bokehGain) : 1.0;
        sum += col * weight;
        totalWeight += weight;
      }

      vec4 result = sum / totalWeight;

      // Subtle warm vignette around the blurred edges
      float vignette = 1.0 - smoothstep(0.4, 0.95, length((vUv - 0.5) * vec2(1.0, 0.85))) * 0.22 * blurFactor;
      result.rgb *= vignette;

      gl_FragColor = result;
    }
  `
};

export class DepthOfFieldPass {
  public pass: ShaderPass;
  public isEnabled: boolean = true;

  constructor() {
    this.pass = new ShaderPass(TiltShiftDoFShader);
    this.pass.renderToScreen = true;
  }

  public setSize(width: number, height: number): void {
    this.pass.uniforms.resolution.value.set(width, height);
  }

  public setFocusY(y: number): void {
    this.pass.uniforms.focusY.value = THREE.MathUtils.clamp(y, 0.1, 0.9);
  }

  public toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    this.pass.uniforms.enabled.value = this.isEnabled ? 1.0 : 0.0;
    return this.isEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.pass.uniforms.enabled.value = enabled ? 1.0 : 0.0;
  }
}
