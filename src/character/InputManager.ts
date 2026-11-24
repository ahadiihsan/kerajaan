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
  private groundMesh!: THREE.Mesh;

  // Touch controls
  public isTouchDevice: boolean = false;
  private joystickContainer: HTMLElement | null = null;
  private joystickKnob: HTMLElement | null = null;

  constructor() {
    this.detectTouch();
    this.setupKeyboardListeners();
    this.setupMouseListeners();
  }

  public initRaycaster(camera: THREE.Camera, groundMesh: THREE.Mesh): void {
    this.camera = camera;
    this.groundMesh = groundMesh;
  }

  private detectTouch(): void {
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.state.isSprinting = true;
      }
      if (e.code === 'Insert' || e.code === 'KeyX') {
        this.state.toggleSit = true;
      }
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
        this.castGroundClick(e.clientX, e.clientY);
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
        this.state.lookDeltaY += dy * 0.005;
      }

      if (this.isLeftMouseDown) {
        // Continuous click-to-move dragging while holding left mouse
        this.castGroundClick(e.clientX, e.clientY);
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
          this.castGroundClick(t.clientX, t.clientY);
        }
      }
    }, { passive: true });

    window.addEventListener('wheel', (e) => {
      this.state.zoomDelta += Math.sign(e.deltaY) * 0.5;
    }, { passive: true });
  }

  private castGroundClick(clientX: number, clientY: number): void {
    if (!this.camera || !this.groundMesh) return;

    this.mousePos.x = (clientX / window.innerWidth) * 2 - 1;
    this.mousePos.y = -(clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mousePos, this.camera);
    const intersects = this.raycaster.intersectObject(this.groundMesh);

    if (intersects.length > 0) {
      this.state.clickMoveTarget = intersects[0].point.clone();
      // Any manual click clears sitting state
      this.state.toggleSit = false;
    }
  }

  public setJoystickElements(container: HTMLElement, knob: HTMLElement): void {
    this.joystickContainer = container;
    this.joystickKnob = knob;
  }

  public update(): void {
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
