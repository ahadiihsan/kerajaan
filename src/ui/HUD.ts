import { TownMap, Landmark } from '../map/TownMap';
import { CharacterController } from '../character/CharacterController';
import { InputManager } from '../character/InputManager';

export class HUD {
  private container: HTMLElement;
  private locationBanner!: HTMLElement;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private loadingOverlay!: HTMLElement;
  private loadingBarFill!: HTMLElement;
  private loadingText!: HTMLElement;

  private townMap: TownMap;
  private player: CharacterController;
  private input: InputManager;

  private currentLocation: string = 'Town Square Plaza';

  constructor(townMap: TownMap, player: CharacterController, input: InputManager) {
    this.townMap = townMap;
    this.player = player;
    this.input = input;

    this.container = document.createElement('div');
    this.container.id = 'hud-container';
    document.body.appendChild(this.container);

    this.buildLoadingScreen();
    this.buildTopBanner();
    this.buildMinimap();
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
        <p class="subtitle">Constructing Medieval Village Map...</p>
        <div class="progress-bar-track">
          <div id="progress-bar-fill" class="progress-bar-fill"></div>
        </div>
        <div id="loading-asset-text" class="asset-text">Preparing assets...</div>
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
      }, 600);
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

    // Fade out hint after user starts moving
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
    // 1. Virtual Joystick elements
    const joyContainer = document.createElement('div');
    joyContainer.id = 'virtual-joystick-container';
    joyContainer.innerHTML = `<div id="virtual-joystick-knob"></div>`;
    this.container.appendChild(joyContainer);

    const knob = joyContainer.querySelector('#virtual-joystick-knob') as HTMLElement;
    this.input.setJoystickElements(joyContainer, knob);

    // 2. Sprint Button for Mobile
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
    this.updateLocation();
    this.drawMinimap();
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
        // Pulse effect
        this.locationBanner.classList.remove('pulse');
        void this.locationBanner.offsetWidth; // re-flow
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
    const scale = 1.0; // 1 meter = 1 pixel on radar

    // Clear background
    ctx.fillStyle = '#1e241d';
    ctx.fillRect(0, 0, width, height);

    // Draw circular parchment border clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, width / 2 - 4, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#2c3b28';
    ctx.fill();

    // Map offset relative to player
    const px = this.player.position.x;
    const pz = this.player.position.z;

    // Draw Roads (Cross streets & plaza)
    ctx.fillStyle = '#655e56';
    // Central Plaza circle
    const plazaX = centerX + (0 - px) * scale;
    const plazaY = centerY + (0 - pz) * scale;
    ctx.beginPath();
    ctx.arc(plazaX, plazaY, 24 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Main Street N-S
    const roadNSX = centerX + (0 - px) * scale;
    ctx.fillRect(roadNSX - 4 * scale, centerY + (-65 - pz) * scale, 8 * scale, 130 * scale);

    // Main Street E-W
    const roadEWY = centerY + (0 - pz) * scale;
    ctx.fillRect(centerX + (-65 - px) * scale, roadEWY - 4 * scale, 130 * scale, 8 * scale);

    // Draw Buildings
    ctx.fillStyle = '#8b4513';
    ctx.strokeStyle = '#4a250b';
    ctx.lineWidth = 1;

    for (const box of this.townMap.collisionBoxes) {
      const bx = centerX + (box.minX - px) * scale;
      const by = centerY + (box.minZ - pz) * scale;
      const bw = (box.maxX - box.minX) * scale;
      const bh = (box.maxZ - box.minZ) * scale;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
    }

    // Draw Landmarks
    for (const lm of this.townMap.landmarks) {
      const lx = centerX + (lm.x - px) * scale;
      const ly = centerY + (lm.z - pz) * scale;

      ctx.fillStyle = lm.type === 'hall' ? '#e5c158' : lm.type === 'tavern' ? '#5dade2' : '#f39c12';
      ctx.beginPath();
      ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Player Indicator (Center)
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Player Heading Cone
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
