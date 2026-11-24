import { TownMap } from '../map/TownMap';
import { CharacterController } from '../character/CharacterController';
import { InputManager } from '../character/InputManager';
import { PlayerCrowd } from '../character/PlayerCrowd';

export class HUD {
  private container: HTMLElement;
  private locationBanner!: HTMLElement;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private loadingOverlay!: HTMLElement;
  private loadingBarFill!: HTMLElement;
  private loadingText!: HTMLElement;

  // Performance & Crowd Monitor elements
  private fpsDisplay!: HTMLElement;
  private crowdCountDisplay!: HTMLElement;
  private frameCount: number = 0;
  private lastFpsTime: number = performance.now();
  private currentFps: number = 60;

  private townMap: TownMap;
  private player: CharacterController;
  private input: InputManager;
  private crowd?: PlayerCrowd;

  private currentLocation: string = 'Town Square Plaza';

  constructor(townMap: TownMap, player: CharacterController, input: InputManager, crowd?: PlayerCrowd) {
    this.townMap = townMap;
    this.player = player;
    this.input = input;
    this.crowd = crowd;

    this.container = document.createElement('div');
    this.container.id = 'hud-container';
    document.body.appendChild(this.container);

    this.buildLoadingScreen();
    this.buildTopBanner();
    this.buildMinimap();
    this.buildPerformanceMonitor();
    this.buildControlsHint();
    this.buildMobileTouchOverlay();
  }

  private buildLoadingScreen(): void {
    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.id = 'loading-overlay';
    this.loadingOverlay.innerHTML = `
      <div class="loading-card">
        <div class="heraldry-icon">🏰</div>
        <h1 class="title">Elderstone Realm</h1>
        <p class="subtitle">Simulating 1,000 Medieval Players...</p>
        <div class="progress-bar-track">
          <div id="progress-bar-fill" class="progress-bar-fill"></div>
        </div>
        <div id="loading-asset-text" class="asset-text">Populating village...</div>
      </div>
    `;
    this.container.appendChild(this.loadingOverlay);

    this.loadingBarFill = this.loadingOverlay.querySelector('#progress-bar-fill')!;
    this.loadingText = this.loadingOverlay.querySelector('#loading-asset-text')!;
  }

  public updateLoading(loaded: number, total: number, name: string): void {
    const pct = total > 0 ? Math.floor((loaded / total) * 100) : 100;
    if (this.loadingBarFill) {
      this.loadingBarFill.style.width = `${pct}%`;
    }
    if (this.loadingText) {
      this.loadingText.textContent = `Entering ${name}...`;
    }
  }

  public hideLoading(): void {
    if (this.loadingOverlay) {
      this.loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        this.loadingOverlay.style.display = 'none';
      }, 500);
    }
  }

  private buildTopBanner(): void {
    this.locationBanner = document.createElement('div');
    this.locationBanner.id = 'location-banner';
    this.locationBanner.innerHTML = `
      <div class="banner-ornament">✦ ✦ ✦</div>
      <div id="location-name" class="location-name">Town Square Plaza</div>
      <div class="realm-tag">Elderstone Kingdom</div>
    `;
    this.container.appendChild(this.locationBanner);
  }

  private buildMinimap(): void {
    const minimapWrap = document.createElement('div');
    minimapWrap.id = 'minimap-wrapper';
    minimapWrap.className = 'ui-interactive';
    minimapWrap.innerHTML = `
      <div class="minimap-frame">
        <canvas id="minimap-canvas" width="160" height="160"></canvas>
        <div class="compass-n">N</div>
      </div>
    `;
    this.container.appendChild(minimapWrap);

    this.minimapCanvas = minimapWrap.querySelector('#minimap-canvas')!;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
  }

  private buildPerformanceMonitor(): void {
    const perfCard = document.createElement('div');
    perfCard.id = 'perf-monitor';
    perfCard.className = 'ui-interactive';
    perfCard.innerHTML = `
      <div class="perf-header">
        <span class="status-dot"></span>
        <span class="perf-title">Load Test Monitor</span>
      </div>
      <div class="perf-stats">
        <div class="stat-item">
          <span class="stat-label">FPS:</span>
          <span id="fps-value" class="stat-val fps-good">60 FPS</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Online:</span>
          <span id="crowd-value" class="stat-val crowd-highlight">1,000 Players</span>
        </div>
      </div>
      <div class="crowd-presets">
        <button class="preset-btn" data-count="100">100</button>
        <button class="preset-btn" data-count="500">500</button>
        <button class="preset-btn active" data-count="1000">1,000</button>
      </div>
    `;
    this.container.appendChild(perfCard);

    this.fpsDisplay = perfCard.querySelector('#fps-value')!;
    this.crowdCountDisplay = perfCard.querySelector('#crowd-value')!;

    // Preset buttons handlers
    const btns = perfCard.querySelectorAll('.preset-btn');
    btns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const count = parseInt((e.target as HTMLElement).getAttribute('data-count') || '1000', 10);
        btns.forEach((b) => b.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');

        if (this.crowd) {
          this.crowd.setCrowdCount(count);
          this.crowdCountDisplay.textContent = `${count.toLocaleString()} Players`;
        }
      });
    });
  }

  private buildControlsHint(): void {
    const hints = document.createElement('div');
    hints.id = 'controls-hint';
    hints.innerHTML = `
      <div class="hint-header">Controls</div>
      <div class="hint-row"><span class="key">W A S D</span> / <span class="key">Arrows</span> Move</div>
      <div class="hint-row"><span class="key">Shift</span> Sprint</div>
      <div class="hint-row"><span class="key">Mouse Drag</span> Look Orbit</div>
      <div class="hint-row"><span class="key">Scroll</span> Zoom View</div>
    `;
    this.container.appendChild(hints);

    let hasMoved = false;
    const checkMove = () => {
      if (Math.abs(this.input.state.moveX) > 0.1 || Math.abs(this.input.state.moveZ) > 0.1) {
        if (!hasMoved) {
          hasMoved = true;
          setTimeout(() => {
            hints.style.opacity = '0.35';
          }, 3000);
        }
      }
    };
    window.addEventListener('keydown', checkMove);
    window.addEventListener('touchstart', checkMove);
  }

  private buildMobileTouchOverlay(): void {
    const joyContainer = document.createElement('div');
    joyContainer.id = 'virtual-joystick-container';
    joyContainer.innerHTML = `<div id="virtual-joystick-knob"></div>`;
    this.container.appendChild(joyContainer);

    const knob = joyContainer.querySelector('#virtual-joystick-knob') as HTMLElement;
    this.input.setJoystickElements(joyContainer, knob);

    const sprintBtn = document.createElement('button');
    sprintBtn.id = 'mobile-sprint-btn';
    sprintBtn.className = 'ui-interactive';
    sprintBtn.innerHTML = `⚡ RUN`;
    this.container.appendChild(sprintBtn);

    let sprintActive = false;
    sprintBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      sprintActive = !sprintActive;
      this.input.state.isSprinting = sprintActive;
      sprintBtn.classList.toggle('active', sprintActive);
    });

    sprintBtn.addEventListener('click', () => {
      sprintActive = !sprintActive;
      this.input.state.isSprinting = sprintActive;
      sprintBtn.classList.toggle('active', sprintActive);
    });
  }

  public update(): void {
    this.updateFps();
    this.updateLocation();
    this.drawMinimap();
  }

  private updateFps(): void {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsTime;

    if (elapsed >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsTime = now;

      if (this.fpsDisplay) {
        this.fpsDisplay.textContent = `${this.currentFps} FPS`;
        this.fpsDisplay.className = `stat-val ${this.currentFps >= 50 ? 'fps-good' : this.currentFps >= 35 ? 'fps-warn' : 'fps-bad'}`;
      }
    }
  }

  private updateLocation(): void {
    const px = this.player.position.x;
    const pz = this.player.position.z;

    let closest = this.townMap.landmarks[0];
    let minDist = 9999;

    for (const lm of this.townMap.landmarks) {
      const dx = px - lm.x;
      const dz = pz - lm.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < minDist) {
        minDist = d;
        closest = lm;
      }
    }

    const newLoc = minDist < 24 ? closest.name : 'Elderstone Countryside';
    if (newLoc !== this.currentLocation) {
      this.currentLocation = newLoc;
      const el = document.getElementById('location-name');
      if (el) {
        el.textContent = this.currentLocation;
        this.locationBanner.classList.remove('pulse');
        void this.locationBanner.offsetWidth;
        this.locationBanner.classList.add('pulse');
      }
    }
  }

  private drawMinimap(): void {
    const ctx = this.minimapCtx;
    const width = this.minimapCanvas.width;
    const height = this.minimapCanvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = 1.0;

    ctx.fillStyle = '#1e241d';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, width / 2 - 4, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#2c3b28';
    ctx.fill();

    const px = this.player.position.x;
    const pz = this.player.position.z;

    // Roads
    ctx.fillStyle = '#7a7065';
    const plazaX = centerX + (0 - px) * scale;
    const plazaY = centerY + (0 - pz) * scale;
    ctx.beginPath();
    ctx.arc(plazaX, plazaY, 24 * scale, 0, Math.PI * 2);
    ctx.fill();

    const roadNSX = centerX + (0 - px) * scale;
    ctx.fillRect(roadNSX - 4 * scale, centerY + (-65 - pz) * scale, 8 * scale, 130 * scale);

    const roadEWY = centerY + (0 - pz) * scale;
    ctx.fillRect(centerX + (-65 - px) * scale, roadEWY - 4 * scale, 130 * scale, 8 * scale);

    // Buildings
    ctx.fillStyle = '#8a4b2a';
    ctx.strokeStyle = '#4e2815';
    ctx.lineWidth = 1;

    for (const box of this.townMap.collisionBoxes) {
      const bx = centerX + (box.minX - px) * scale;
      const by = centerY + (box.minZ - pz) * scale;
      const bw = (box.maxX - box.minX) * scale;
      const bh = (box.maxZ - box.minZ) * scale;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
    }

    // Landmarks
    for (const lm of this.townMap.landmarks) {
      const lx = centerX + (lm.x - px) * scale;
      const ly = centerY + (lm.z - pz) * scale;

      ctx.fillStyle = lm.type === 'hall' ? '#e5c158' : lm.type === 'tavern' ? '#5dade2' : '#f39c12';
      ctx.beginPath();
      ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    const facingAngle = this.player.mesh.rotation.y;
    const coneLen = 11;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.sin(facingAngle) * coneLen,
      centerY + Math.cos(facingAngle) * coneLen
    );
    ctx.stroke();

    ctx.restore();
  }
}
