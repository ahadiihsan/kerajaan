import * as THREE from 'three';

export interface InputState {
  moveX: number;
  moveZ: number;
  isSprinting: boolean;
  lookDeltaX: number;
  lookDeltaY: number;
  zoomDelta: number;
  clickMoveTarget: THREE.Vector3 | null;
  toggleSit: boolean;
  jump: boolean;
}

export class InputManager {
  public state: InputState = {
    moveX: 0,
    moveZ: 0,
    isSprinting: false,
    lookDeltaX: 0,
    lookDeltaY: 0,
    zoomDelta: 0,
    clickMoveTarget: null,
    toggleSit: false,
    jump: false,
  };

  private keys: { [key: string]: boolean } = {};
  private isRightMouseDown: boolean = false;
  private isLeftMouseDown: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // Raycasting for Click-to-Move
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mousePos: THREE.Vector2 = new THREE.Vector2();
  private camera!: THREE.Camera;
  private ground!: THREE.Group;
  private groundClickPending = false;
  private groundLimit = 0;

  // Touch controls
  public isTouchDevice: boolean = false;
  private joystickContainer: HTMLElement | null = null;
  private joystickKnob: HTMLElement | null = null;

  constructor() {
    this.detectTouch();
    this.setupKeyboardListeners();
    this.setupMouseListeners();
  }

  public initRaycaster(camera: THREE.Camera, ground: THREE.Group, groundLimit: number): void {
    this.camera = camera;
    this.ground = ground;
    this.groundLimit = groundLimit;
  }

  private detectTouch(): void {
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select, button, [contenteditable]')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) this.state.jump = true;
        return;
      }
      this.keys[e.code] = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.state.isSprinting = true;
      }
      if (e.code === 'Insert' || e.code === 'KeyX') {
        this.state.toggleSit = true;
      }
    });

    window.addEventListener('blur', () => {
      this.keys = {};
      this.state.isSprinting = false;
      this.isLeftMouseDown = this.isRightMouseDown = false;
      this.groundClickPending = false;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.state.isSprinting = false;
      }
    });
  }

  private setupMouseListeners(): void {
    // Disable default browser context menu for authentic RO1 right-click camera drag
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement)?.closest('.ui-interactive')) return;

      if (e.button === 0) {
        // Left Click: Ragnarok Online Click-to-Move!
        this.isLeftMouseDown = true;
        this.queueGroundClick(e.clientX, e.clientY);
      } else if (e.button === 2) {
        // Right Click: Ragnarok Online Camera Rotation!
        this.isRightMouseDown = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isRightMouseDown) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        this.state.lookDeltaX += dx * 0.005;
        this.state.lookDeltaY = 0; // Vertical camera tilt disabled
      }

      if (this.isLeftMouseDown) {
        // Continuous click-to-move dragging while holding left mouse
        this.queueGroundClick(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isLeftMouseDown = false;
      if (e.button === 2) this.isRightMouseDown = false;
    });

    // Touch support (tap ground to move, drag to rotate)
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        if (!(e.target as HTMLElement)?.closest('.ui-interactive')) {
          this.queueGroundClick(t.clientX, t.clientY);
        }
      }
    }, { passive: true });

    window.addEventListener('wheel', (e) => {
      if ((e.target as HTMLElement)?.closest('.ui-interactive')) return;
      this.state.zoomDelta += Math.sign(e.deltaY) * 0.5;
    }, { passive: true });
  }

  private queueGroundClick(clientX: number, clientY: number): void {
    this.mousePos.set((clientX / window.innerWidth) * 2 - 1, 1 - (clientY / window.innerHeight) * 2);
    this.groundClickPending = true;
  }

  private castGroundClick(): void {
    if (!this.camera) return;
    this.raycaster.setFromCamera(this.mousePos, this.camera);
    const ground = this.raycaster.intersectObjects(this.ground.children, false)[0]?.point;

    if (ground && Math.abs(ground.x) <= this.groundLimit && Math.abs(ground.z) <= this.groundLimit) {
      this.state.clickMoveTarget = ground;
      // Any manual click clears sitting state
      this.state.toggleSit = false;
    }
  }

  public setJoystickElements(container: HTMLElement, knob: HTMLElement): void {
    this.joystickContainer = container;
    this.joystickKnob = knob;
  }

  public update(): void {
    if (this.groundClickPending) {
      this.groundClickPending = false;
      this.castGroundClick();
    }
    // Keyboard WASD overrides click-to-move if keys are pressed
    let x = 0;
    let z = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) z -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) z += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

    const len = Math.sqrt(x * x + z * z);
    if (len > 0) {
      this.state.moveX = x / len;
      this.state.moveZ = z / len;
      this.state.clickMoveTarget = null; // Clear click target on manual WASD
      this.state.toggleSit = false;
    } else {
      this.state.moveX = 0;
      this.state.moveZ = 0;
    }
  }

  public consumeLookDelta(): { dx: number; dy: number } {
    const dx = this.state.lookDeltaX;
    const dy = this.state.lookDeltaY;
    this.state.lookDeltaX = 0;
    this.state.lookDeltaY = 0;
    return { dx, dy };
  }

  public consumeZoomDelta(): number {
    const zoom = this.state.zoomDelta;
    this.state.zoomDelta = 0;
    return zoom;
  }
}
