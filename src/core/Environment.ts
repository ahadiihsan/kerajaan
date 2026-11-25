import * as THREE from 'three';

export class Environment {
  public hour = 8;
  public day = 1;
  public paused = false;

  private readonly dayLengthSeconds = 240;
  private readonly horizon = new THREE.Color(0xc9dbcb);
  private readonly night = new THREE.Color(0x151f3a);
  private readonly dusk = new THREE.Color(0xd78b68);
  private readonly daylight = new THREE.Color(0xffebc4);
  private readonly moonlight = new THREE.Color(0xa6c0f0);
  private readonly ambientDay = new THREE.Color(0xc4ddff);
  private readonly tint = new THREE.Color();
  private readonly fog = new THREE.Fog(this.horizon, 28, 95);
  private readonly sky = new THREE.HemisphereLight(0xc4ddff, 0x756552, 1.02);
  private readonly sun = new THREE.DirectionalLight(0xffebc4, 2.7);

  constructor(scene: THREE.Scene) {
    scene.background = this.tint;
    scene.fog = this.fog;

    const { sun } = this;
    // A fixed light direction keeps the forest's static shadow map reusable across the cycle.
    sun.position.set(-34, 52, 29);
    sun.castShadow = true;
    sun.shadow.mapSize.set(3072, 3072);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -83;
    sun.shadow.camera.right = sun.shadow.camera.top = 83;
    sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.045;
    scene.add(this.sky, sun);
    this.update(0);
  }

  public get phase(): string {
    if (this.hour < 5 || this.hour >= 20) return 'Night';
    if (this.hour < 7) return 'Dawn';
    return this.hour < 17 ? 'Day' : 'Dusk';
  }

  public update(delta: number): void {
    if (!this.paused) {
      this.hour += delta * 24 / this.dayLengthSeconds;
      this.day += Math.floor(this.hour / 24);
      this.hour %= 24;
    }
    const elevation = Math.sin((this.hour - 6) * Math.PI / 12);
    const light = THREE.MathUtils.smoothstep(elevation, -0.21, 0.37);
    const twilight = (1 - THREE.MathUtils.smoothstep(Math.abs(elevation), 0, 0.46)) * light;
    this.tint.copy(this.night).lerp(this.horizon, light).lerp(this.dusk, twilight * 0.48);
    this.fog.color.copy(this.tint);
    this.sun.color.copy(this.moonlight).lerp(this.daylight, light).lerp(this.dusk, twilight * 0.42);
    this.sun.intensity = 0.32 + light * 2.38;
    this.sky.color.copy(this.moonlight).lerp(this.ambientDay, light);
    this.sky.intensity = 0.38 + light * 0.64;
  }
}
