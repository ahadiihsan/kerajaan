export interface InputState {
  moveX: number; // -1 to 1 (left/right)
  moveZ: number; // -1 to 1 (forward/backward)
  isSprinting: boolean;
  lookDeltaX: number; // camera yaw delta
  lookDeltaY: number; // camera pitch delta
  zoomDelta: number;
}

export class InputManager {
  public state: InputState = {
    moveX: 0,
    moveZ: 0,
    isSprinting: false,
    lookDeltaX: 0,
    lookDeltaY: 0,
    zoomDelta: 0,
  };

  private keys: { [key: string]: boolean } = {};
  private isPointerDown: boolean = false;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;

  // Touch joystick properties
  public isTouchDevice: boolean = false;
  private joystickActive: boolean = false;
  private joystickTouchId: number | null = null;
  private joystickCenter = { x: 0, y: 0 };
  private lookTouchId: number | null = null;
  private lastLookTouch = { x: 0, y: 0 };

  // DOM elements for virtual joystick
  private joystickContainer: HTMLElement | null = null;
  private joystickKnob: HTMLElement | null = null;

  constructor() {
    this.detectTouch();
    this.setupKeyboardListeners();
    this.setupMouseListeners();
    this.setupTouchListeners();
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
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.state.isSprinting = false;
      }
    });
  }

  private setupMouseListeners(): void {
    window.addEventListener('mousedown', (e) => {
      // Don't trigger look if clicking on UI buttons
      if ((e.target as HTMLElement)?.closest('.ui-interactive')) return;
      this.isPointerDown = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerDown) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      this.state.lookDeltaX += dx * 0.005;
      this.state.lookDeltaY += dy * 0.005;
    });

    window.addEventListener('mouseup', () => {
      this.isPointerDown = false;
    });

    window.addEventListener('wheel', (e) => {
      this.state.zoomDelta += Math.sign(e.deltaY) * 0.5;
    }, { passive: true });
  }

  public setJoystickElements(container: HTMLElement, knob: HTMLElement): void {
    this.joystickContainer = container;
    this.joystickKnob = knob;
  }

  private setupTouchListeners(): void {
    window.addEventListener('touchstart', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // Left half of screen -> Virtual Joystick
        if (touch.clientX < window.innerWidth / 2 && this.joystickTouchId === null) {
          this.joystickTouchId = touch.identifier;
          this.joystickActive = true;
          this.joystickCenter = { x: touch.clientX, y: touch.clientY };

          if (this.joystickContainer && this.joystickKnob) {
            this.joystickContainer.style.display = 'block';
            this.joystickContainer.style.left = `${touch.clientX - 50}px`;
            this.joystickContainer.style.top = `${touch.clientY - 50}px`;
            this.joystickKnob.style.transform = 'translate(0px, 0px)';
          }
        }
        // Right half of screen -> Camera Look
        else if (touch.clientX >= window.innerWidth / 2 && this.lookTouchId === null) {
          if ((e.target as HTMLElement)?.closest('.ui-interactive')) continue;
          this.lookTouchId = touch.identifier;
          this.lastLookTouch = { x: touch.clientX, y: touch.clientY };
        }
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // Process joystick movement
        if (touch.identifier === this.joystickTouchId) {
          const dx = touch.clientX - this.joystickCenter.x;
          const dy = touch.clientY - this.joystickCenter.y;
          const maxDist = 45;
          const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist);
          const angle = Math.atan2(dy, dx);

          const clampedX = Math.cos(angle) * dist;
          const clampedY = Math.sin(angle) * dist;

          if (this.joystickKnob) {
            this.joystickKnob.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
          }

          // Normalized movement
          this.state.moveX = clampedX / maxDist;
          this.state.moveZ = clampedY / maxDist;
        }

        // Process camera look swipe
        if (touch.identifier === this.lookTouchId) {
          const dx = touch.clientX - this.lastLookTouch.x;
          const dy = touch.clientY - this.lastLookTouch.y;
          this.lastLookTouch = { x: touch.clientX, y: touch.clientY };

          this.state.lookDeltaX += dx * 0.007;
          this.state.lookDeltaY += dy * 0.007;
        }
      }
    }, { passive: false });

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        if (touch.identifier === this.joystickTouchId) {
          this.joystickTouchId = null;
          this.joystickActive = false;
          this.state.moveX = 0;
          this.state.moveZ = 0;

          if (this.joystickContainer && this.joystickKnob) {
            this.joystickContainer.style.display = 'none';
            this.joystickKnob.style.transform = 'translate(0px, 0px)';
          }
        }

        if (touch.identifier === this.lookTouchId) {
          this.lookTouchId = null;
        }
      }
    };

    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  }

  public update(): void {
    // If not using touch joystick, poll keyboard
    if (!this.joystickActive) {
      let x = 0;
      let z = 0;

      if (this.keys['KeyW'] || this.keys['ArrowUp']) z -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) z += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

      // Normalize diagonal keyboard movement
      const len = Math.sqrt(x * x + z * z);
      if (len > 0) {
        this.state.moveX = x / len;
        this.state.moveZ = z / len;
      } else {
        this.state.moveX = 0;
        this.state.moveZ = 0;
      }
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
