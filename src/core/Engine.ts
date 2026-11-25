import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { DepthOfFieldPass } from './DepthOfFieldPass';

import {
  GRAPHICS_PRESETS, loadGraphics, saveGraphics, VIEW_DISTANCES, type GraphicsOptions, type GraphicsPreset
} from './GraphicsOptions';

export interface Updatable {
  update(delta: number, elapsed: number): void;
}

export class Engine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private postprocessing?: { composer: EffectComposer; depthOfField: DepthOfFieldPass };
  private preference = loadGraphics();
  public get graphics(): Readonly<GraphicsOptions> { return this.preference.options; }
  public get graphicsPreset(): GraphicsPreset { return this.preference.preset; }
  private updatables: Updatable[] = [];
  private isRunning = false;
  private frameRequest: number | null = null;
  private lastFrameAt?: number;
  private nextFrameAt?: number;
  private elapsed = 0;
  private container: HTMLElement;

  constructor(containerId: string = 'app') {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`Element #${containerId} not found`);
    }
    this.container = el;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. HD-2D Diorama Camera (Narrow FOV 36 deg for isometric miniature depth)
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 115);
    this.camera.position.set(0, 11, 15);
    this.camera.lookAt(0, 1.2, 0);

    // 3. WebGL Renderer with High-End Lighting & ACES Filmic Tone Mapping
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'low-power',
      antialias: this.graphics.renderScale >= 0.85,
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    // The forest geometry is static. Sprites use their own contact shadows.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.applyGraphics();

    // 6. Window Resize Handler
    window.addEventListener('resize', this.onResize.bind(this));
  }

  public registerUpdatable(item: Updatable): void {
    this.updatables.push(item);
  }

  public unregisterUpdatable(item: Updatable): void {
    const idx = this.updatables.indexOf(item);
    if (idx !== -1) {
      this.updatables.splice(idx, 1);
    }
  }

  public setGraphics(preset: GraphicsPreset): void {
    const previous = this.graphics;
    this.preference = { preset, options: { ...GRAPHICS_PRESETS[preset].options } };
    this.applyGraphics(previous);
    saveGraphics(this.preference);
  }

  public updateGraphics(changes: Partial<GraphicsOptions>): void {
    const previous = this.graphics;
    this.preference.options = { ...this.graphics, ...changes };
    this.applyGraphics(previous);
    saveGraphics(this.preference);
  }

  private applyGraphics(previous?: Readonly<GraphicsOptions>): void {
    const settings = this.graphics;
    if (previous?.frameLimit !== settings.frameLimit) this.nextFrameAt = undefined;
    if (this.renderer.shadowMap.enabled !== settings.shadows) {
      this.renderer.shadowMap.enabled = settings.shadows;
      this.renderer.shadowMap.needsUpdate = settings.shadows;
    }
    if (previous?.viewDistance !== settings.viewDistance) this.applyViewDistance();

    if (settings.depthOfField && !this.postprocessing) {
      const composer = new EffectComposer(this.renderer);
      const depthOfField = new DepthOfFieldPass();
      composer.addPass(new RenderPass(this.scene, this.camera));
      composer.addPass(depthOfField.pass);
      composer.addPass(new OutputPass());
      this.postprocessing = { composer, depthOfField };
    } else if (!settings.depthOfField && this.postprocessing) {
      const { composer, depthOfField } = this.postprocessing;
      depthOfField.pass.dispose();
      composer.passes.at(-1)?.dispose();
      composer.dispose();
      this.postprocessing = undefined;
    }

    if (previous?.renderScale !== settings.renderScale || previous?.depthOfField !== settings.depthOfField) {
      this.onResize();
    }
  }

  private applyViewDistance(): void {
    const distance = VIEW_DISTANCES[this.graphics.viewDistance];
    this.camera.far = distance + 20;
    this.camera.updateProjectionMatrix();
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = distance * (28 / 95);
      this.scene.fog.far = distance;
    }
  }

  private onResize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const maxTextureSize = this.renderer.capabilities.maxTextureSize;
    const pixelRatio = Math.min(this.graphics.renderScale, maxTextureSize / Math.max(width, height));

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setDrawingBufferSize(width, height, pixelRatio);
    this.renderer.domElement.style.width = `${width}px`;
    this.renderer.domElement.style.height = `${height}px`;

    if (this.postprocessing) {
      const { composer, depthOfField } = this.postprocessing;
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      depthOfField.setSize(width * pixelRatio, height * pixelRatio);
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.applyViewDistance();
    document.addEventListener('visibilitychange', this.syncFrameRequest);
    this.syncFrameRequest();
  }

  public stop(): void {
    this.isRunning = false;
    document.removeEventListener('visibilitychange', this.syncFrameRequest);
    this.syncFrameRequest();
  }

  private syncFrameRequest = (): void => {
    if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest);
    this.lastFrameAt = this.nextFrameAt = undefined;
    this.frameRequest = this.isRunning && !document.hidden ? requestAnimationFrame(this.renderFrame) : null;
  };

  private renderFrame = (now: number): void => {
    this.frameRequest = null;
    if (!this.isRunning || document.hidden) return;
    this.frameRequest = requestAnimationFrame(this.renderFrame);

    const limit = this.graphics.frameLimit;
    if (limit !== 'display') {
      const interval = 1000 / limit;
      const scheduled = this.nextFrameAt ?? now;
      // Allow small refresh-timestamp jitter without missing an entire display refresh.
      if (now + Math.min(2, interval * 0.15) < scheduled) return;
      this.nextFrameAt = (now - scheduled > interval / 2 ? now : scheduled) + interval;
    }
    const delta = Math.min((now - (this.lastFrameAt ?? now)) / 1000, 0.1);
    this.lastFrameAt = now;
    this.elapsed += delta;

    for (const item of this.updatables) item.update(delta, this.elapsed);
    if (this.postprocessing) {
      this.postprocessing.composer.render(delta);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  };
}
