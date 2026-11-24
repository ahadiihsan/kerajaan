import { TownMap } from '../map/TownMap';
import { CharacterController } from '../character/CharacterController';
import { InputManager } from '../character/InputManager';
import { PlayerCrowd } from '../character/PlayerCrowd';
import { DepthOfFieldPass } from '../core/DepthOfFieldPass';

export class HUD {
  private container: HTMLElement;
  private locationBanner!: HTMLElement;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private loadingOverlay!: HTMLElement;
  private loadingBarFill!: HTMLElement;
  private loadingText!: HTMLElement;

  // RO1 Classic Basic Info Window
  private fpsDisplay!: HTMLElement;
  private crowdCountDisplay!: HTMLElement;
  private frameCount: number = 0;
  private lastFpsTime: number = performance.now();
  private currentFps: number = 60;

  private townMap: TownMap;
  private player: CharacterController;
  private input: InputManager;
  private crowd?: PlayerCrowd;
  private dofPass?: DepthOfFieldPass;

  private currentLocation: string = 'Prontera Central Fountain';

  constructor(
    townMap: TownMap,
    player: CharacterController,
    input: InputManager,
    crowd?: PlayerCrowd,
    dofPass?: DepthOfFieldPass
  ) {
    this.townMap = townMap;
    this.player = player;
    this.input = input;
    this.crowd = crowd;
    this.dofPass = dofPass;

    this.container = document.createElement('div');
    this.container.id = 'hud-container';
    document.body.appendChild(this.container);

    this.buildLoadingScreen();
    this.buildTopBanner();
    this.buildMinimap();
    this.buildRO1BasicInfoWindow();
    this.buildRO1ActionHotbar();
    this.buildControlsHint();
  }

  private buildLoadingScreen(): void {
    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.id = 'loading-overlay';
    this.loadingOverlay.innerHTML = `
      <div class="loading-card">
        <div class="heraldry-icon">⚔️</div>
        <h1 class="title">Ragnarok Online</h1>
        <p class="subtitle">Entering Capital City Prontera (1,000 Players)...</p>
        <div class="progress-bar-track">
          <div id="progress-bar-fill" class="progress-bar-fill"></div>
        </div>
        <div id="loading-asset-text" class="asset-text">Loading Prontera assets...</div>
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
      this.loadingText.textContent = `Connecting: ${name}...`;
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
      <div class="banner-ornament">⚔ Prontera Capital ⚔</div>
      <div id="location-name" class="location-name">Prontera Central Fountain</div>
      <div class="realm-tag">Kingdom of Rune-Midgard</div>
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

  /**
   * Classic Ragnarok Online 1 Basic Information Window
   */
  private buildRO1BasicInfoWindow(): void {
    const roWindow = document.createElement('div');
    roWindow.id = 'ro-info-window';
    roWindow.className = 'ui-interactive';
    roWindow.innerHTML = `
      <div class="ro-window-titlebar">
        <span class="ro-title-icon">⚔</span>
        <span class="ro-title-text">Basic Info</span>
        <span class="ro-window-close">-</span>
      </div>
      <div class="ro-window-body">
        <div class="ro-char-name">Novice Traveler</div>
        <div class="ro-char-job">Swordsman Lv. 99 / Job 50</div>
        
        <!-- HP Bar -->
        <div class="ro-bar-row">
          <span class="ro-bar-label">HP</span>
          <div class="ro-bar-track">
            <div class="ro-bar-fill hp-fill" style="width: 100%;"></div>
            <span class="ro-bar-text">8,420 / 8,420</span>
          </div>
        </div>

        <!-- SP Bar -->
        <div class="ro-bar-row">
          <span class="ro-bar-label">SP</span>
          <div class="ro-bar-track">
            <div class="ro-bar-fill sp-fill" style="width: 100%;"></div>
            <span class="ro-bar-text">620 / 620</span>
          </div>
        </div>

        <!-- Live Server Status -->
        <div class="ro-server-status">
          <div class="ro-status-row">
            <span class="ro-dot"></span>
            <span class="ro-status-text">Server: Prontera 01</span>
          </div>
          <div class="ro-stats-row">
            <span id="fps-value" class="ro-fps">75 FPS</span>
            <span id="crowd-value" class="ro-crowd">1,000 Players</span>
          </div>
        </div>

        <!-- Crowd Density Preset Buttons -->
        <div class="crowd-presets">
          <button class="preset-btn" data-count="100">100</button>
          <button class="preset-btn" data-count="500">500</button>
          <button class="preset-btn active" data-count="1000">1,000</button>
        </div>
      </div>
    `;
    this.container.appendChild(roWindow);

    this.fpsDisplay = roWindow.querySelector('#fps-value')!;
    this.crowdCountDisplay = roWindow.querySelector('#crowd-value')!;

    const btns = roWindow.querySelectorAll('.preset-btn');
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

  /**
   * Classic RO1 Action Hotbar (Sit/Stand, Emotes, Camera Reset, DoF Depth)
   */
  private buildRO1ActionHotbar(): void {
    const hotbar = document.createElement('div');
    hotbar.id = 'ro-action-hotbar';
    hotbar.className = 'ui-interactive';
    hotbar.innerHTML = `
      <button id="ro-btn-sit" class="ro-action-btn" title="Toggle Sit/Stand (/sit or press X)">🪑 Sit / Stand</button>
      <button id="ro-btn-emote" class="ro-action-btn" title="Emote (/gg)">♥ Emote</button>
      <button id="ro-btn-dof" class="ro-action-btn active" title="Toggle Octopath-style Depth of Field">✨ DoF: ON</button>
      <button id="ro-btn-cam" class="ro-action-btn" title="Reset Camera">🎥 Reset Cam</button>
    `;
    this.container.appendChild(hotbar);

    const sitBtn = hotbar.querySelector('#ro-btn-sit')!;
    sitBtn.addEventListener('click', () => {
      this.player.isSitting = !this.player.isSitting;
      sitBtn.classList.toggle('active', this.player.isSitting);
    });

    const emoteBtn = hotbar.querySelector('#ro-btn-emote')!;
    emoteBtn.addEventListener('click', () => {
      this.showFloatingEmote('♥');
    });

    const dofBtn = hotbar.querySelector('#ro-btn-dof')!;
    dofBtn.addEventListener('click', () => {
      if (this.dofPass) {
        const enabled = this.dofPass.toggle();
        dofBtn.classList.toggle('active', enabled);
        dofBtn.innerHTML = enabled ? '✨ DoF: ON' : '✨ DoF: OFF';
      }
    });

    const camBtn = hotbar.querySelector('#ro-btn-cam')!;
    camBtn.addEventListener('click', () => {
      this.player.cameraDistance = 12.0;
    });
  }

  private showFloatingEmote(symbol: string): void {
    const bubble = document.createElement('div');
    bubble.className = 'ro-emote-bubble';
    bubble.textContent = symbol;
    document.body.appendChild(bubble);

    setTimeout(() => {
      bubble.remove();
    }, 1400);
  }

  private buildControlsHint(): void {
    const hints = document.createElement('div');
    hints.id = 'controls-hint';
    hints.innerHTML = `
      <div class="hint-header">Ragnarok Online 1 Controls</div>
      <div class="hint-row"><span class="key">Left Click</span> Move to Tile (Green Ripple)</div>
      <div class="hint-row"><span class="key">Right Click Drag</span> Rotate Camera Orbit</div>
      <div class="hint-row"><span class="key">Scroll</span> Zoom In / Out</div>
      <div class="hint-row"><span class="key">X</span> or <span class="key">Insert</span> Toggle Sit (/sit)</div>
      <div class="hint-row"><span class="key">W A S D</span> Keyboard Move</div>
    `;
    this.container.appendChild(hints);
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

    const newLoc = minDist < 24 ? closest.name : 'Rune-Midgard Outskirts';
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

    // Prontera Fountain Icon (Blue circle)
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.arc(plazaX, plazaY, 5 * scale, 0, Math.PI * 2);
    ctx.fill();

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
