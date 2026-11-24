import * as THREE from 'three';

export interface Updatable {
  update(delta: number, elapsed: number): void;
}

export class Engine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
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

    // 2. Camera
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 800);
    this.camera.position.set(0, 15, 30);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // 4. Clock
    this.clock = new THREE.Clock();

    // 5. Window Resize Handler
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

      this.renderer.render(this.scene, this.camera);
    };

    requestAnimationFrame(loop);
  }

  public stop(): void {
    this.isRunning = false;
  }
}
