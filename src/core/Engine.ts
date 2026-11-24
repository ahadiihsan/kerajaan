import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { DepthOfFieldPass } from './DepthOfFieldPass';

export interface Updatable {
  update(delta: number, elapsed: number): void;
}

export class Engine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public composer: EffectComposer;
  public dofPass: DepthOfFieldPass;
  public clock: THREE.Clock;
  private updatables: Updatable[] = [];
  private isRunning: boolean = false;
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
    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 500);
    this.camera.position.set(0, 11, 15);
    this.camera.lookAt(0, 1.2, 0);

    // 3. WebGL Renderer with High-End Lighting & ACES Filmic Tone Mapping
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // 4. Post-processing Composer with Octopath-style Depth of Field
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.dofPass = new DepthOfFieldPass();
    this.dofPass.setSize(width, height);
    this.composer.addPass(this.dofPass.pass);

    // 5. Clock
    this.clock = new THREE.Clock();

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

  private onResize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.composer.setSize(width, height);
    this.dofPass.setSize(width, height);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();

    const loop = () => {
      if (!this.isRunning) return;
      requestAnimationFrame(loop);

      const delta = Math.min(this.clock.getDelta(), 0.1);
      const elapsed = this.clock.getElapsedTime();

      for (let i = 0; i < this.updatables.length; i++) {
        this.updatables[i].update(delta, elapsed);
      }

      // Render through HD-2D Postprocessing Composer
      this.composer.render();
    };

    requestAnimationFrame(loop);
  }

  public stop(): void {
    this.isRunning = false;
  }
}
