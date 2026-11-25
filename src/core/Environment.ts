import * as THREE from 'three';

export class Environment {
  private scene: THREE.Scene;
  public dirLight!: THREE.DirectionalLight;
  public hemiLight!: THREE.HemisphereLight;
  public groundMesh!: THREE.Mesh;
  public lanterns: THREE.PointLight[] = [];

  public hour = 8;
  public day = 1;
  public paused = false;
  /** Four real minutes per game day. */
  public dayLengthSeconds = 240;
  private skyMaterial!: THREE.ShaderMaterial;
  private terrainMaterial!: THREE.ShaderMaterial;
  private nightColor = new THREE.Color(0x101c3d);
  private dayColor = new THREE.Color(0xaecae0);
  private duskColor = new THREE.Color(0xce886c);
  private warmLight = new THREE.Color(0xffbe7a);
  private daylight = new THREE.Color(0xfff0d8);
  private moonlight = new THREE.Color(0x8aabed);
  private skyBlue = new THREE.Color(0x477da7);
  private ambientDay = new THREE.Color(0xd4e7f8);
  private tint = new THREE.Color();
  private sunDirection = new THREE.Vector3();

  public get phase(): string {
    if (this.hour < 5 || this.hour >= 20) return 'Night';
    if (this.hour < 7) return 'Dawn';
    if (this.hour < 17) return 'Day';
    return 'Dusk';
  }

  public update(delta: number): void {
    if (!this.paused) {
      this.hour += delta * 24 / this.dayLengthSeconds;
      if (this.hour >= 24) { this.day += Math.floor(this.hour / 24); this.hour %= 24; }
    }
    const angle = (this.hour - 6) / 24 * Math.PI * 2;
    const elevation = Math.sin(angle);
    const light = THREE.MathUtils.smoothstep(elevation, -0.15, 0.35);
    const twilight = (1 - THREE.MathUtils.smoothstep(Math.abs(elevation), 0, 0.4)) * light;
    this.tint.copy(this.nightColor).lerp(this.dayColor, light).lerp(this.duskColor, twilight * 0.7);
    (this.scene.background as THREE.Color).copy(this.tint);
    (this.scene.fog as THREE.FogExp2).color.copy(this.tint);
    this.skyMaterial.uniforms.horizonColor.value.copy(this.tint);
    this.skyMaterial.uniforms.topColor.value.copy(this.nightColor).lerp(this.skyBlue, light);
    this.sunDirection.set(Math.cos(angle) * 65, Math.abs(elevation) * 65 + 8, 30).normalize();
    this.skyMaterial.uniforms.sunPosition.value.copy(this.sunDirection);
    this.skyMaterial.uniforms.daylight.value = light;
    this.dirLight.position.copy(this.sunDirection).multiplyScalar(90);
    this.dirLight.color.copy(this.moonlight).lerp(this.warmLight, light).lerp(this.daylight, light * (1 - twilight));
    this.dirLight.intensity = 0.3 + light * 1.7;
    this.hemiLight.color.copy(this.moonlight).lerp(this.ambientDay, light);
    this.hemiLight.intensity = 0.45 + light * 0.65;
    this.terrainMaterial.uniforms.sunDirection.value.copy(this.sunDirection);
    this.terrainMaterial.uniforms.lightTint.value.copy(this.moonlight).lerp(this.daylight, light);
    this.terrainMaterial.uniforms.lightLevel.value = 0.18 + light * 0.82;
    for (const lantern of this.lanterns) lantern.intensity = (1 - light) * 5;
  }

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupLighting();
    this.setupSkyAndFog();
    this.setupTerrain();
    // Small pools of lamplight keep the homestead welcoming after sundown.
    for (const [x, z] of [[-7, -1], [9, -6]]) {
      const light = new THREE.PointLight(0xffb65c, 0, 10, 1.4);
      light.position.set(x, 1.7, z);
      this.lanterns.push(light);
      this.scene.add(light);
    }
    this.update(0);

  }

  private setupLighting(): void {
    // 1. Soft Atmospheric Hemisphere Sky & Earth
    this.hemiLight = new THREE.HemisphereLight(0xd4e7f8, 0x483525, 1.1);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // 2. Cinematic Golden Sun Directional Light
    this.dirLight = new THREE.DirectionalLight(0xffedd2, 2.0);
    this.dirLight.position.set(30, 65, 35);
    this.dirLight.castShadow = true;

    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 220;

    const d = 65;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;

    this.dirLight.shadow.bias = -0.0003;
    this.dirLight.shadow.normalBias = 0.03;

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);
  }

  private setupSkyAndFog(): void {
    // Octopath-style cinematic soft horizon haze
    const fogColor = new THREE.Color(0xaecae0);
    this.scene.background = fogColor;
    this.scene.fog = new THREE.FogExp2(fogColor.getHex(), 0.0075);

    // Atmospheric sky dome
    const skyGeo = new THREE.SphereGeometry(350, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x285177) },
        horizonColor: { value: new THREE.Color(0xaecae0) },
        daylight: { value: 1 },
        sunPosition: { value: new THREE.Vector3(45, 75, 40).normalize() },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform float daylight;
        uniform vec3 sunPosition;
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = max(0.0, dir.y);
          vec3 sky = mix(horizonColor, topColor, pow(h, 0.6));
          float sunGlow = max(0.0, dot(dir, sunPosition));
          sky += vec3(1.0, 0.92, 0.75) * pow(sunGlow, 24.0) * 0.4 * daylight;
          gl_FragColor = vec4(sky, 1.0);
        }
      `
    });

    this.skyMaterial = skyMat;
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
  }

  private setupTerrain(): void {
    const size = 260;
    const segments = 64;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const distFromCenter = Math.sqrt(x * x + z * z);

      if (distFromCenter > 105) {
        const factor = Math.min(1.0, (distFromCenter - 105) / 25);
        const hill = (Math.sin(x * 0.05) * Math.cos(z * 0.05) * 4.0 +
                      Math.sin(x * 0.02 + 0.8) * 6.0) * factor;
        pos.setY(i, Math.max(0, hill));
      } else {
        pos.setY(i, 0);
      }
    }
    geo.computeVertexNormals();

    // Diorama ground: Warm stone cobblestones, wooden bridges, and meadow grass
    const terrainMat = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: new THREE.Vector3(0, 1, 0) },
        lightTint: { value: new THREE.Color(0xffffff) },
        lightLevel: { value: 1 },
        grassColor: { value: new THREE.Color(0x80ad43) },
        grassDarkColor: { value: new THREE.Color(0x4c863c) },
        dirtColor: { value: new THREE.Color(0xc7a35f) },
        stoneColor: { value: new THREE.Color(0x9a8f82) },
        stoneDarkColor: { value: new THREE.Color(0x786e62) },
        mortarColor: { value: new THREE.Color(0x564d43) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunDirection;
        uniform vec3 lightTint;
        uniform float lightLevel;
        uniform vec3 grassColor;
        uniform vec3 grassDarkColor;
        uniform vec3 dirtColor;
        uniform vec3 stoneColor;
        uniform vec3 stoneDarkColor;
        uniform vec3 mortarColor;
        varying vec3 vWorldPos;
        varying vec3 vNormal;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }

        void main() {
          vec2 xz = vWorldPos.xz;
          float dist = length(xz);

          // Meadow grass
          float gn = noise(xz * 0.65) * 0.55 + noise(xz * 1.7) * 0.3 + noise(xz * 5.0) * 0.15;
          gn = smoothstep(0.2, 0.8, gn);
          vec3 grass = mix(grassDarkColor, grassColor, gn);

          // A soft, winding footpath through a grassy woodland clearing.
          float trailCenter = sin(xz.y * 0.065) * 5.0;
          float trail = 1.0 - smoothstep(0.85, 1.25, abs(xz.x - trailCenter) + (noise(xz * 2.0) - 0.5) * 0.65);
          float homePath = (1.0 - smoothstep(0.6, 1.0, abs(xz.y + 1.0 + xz.x * 0.3) + (noise(xz * 2.5) - 0.5) * 0.45))
            * (1.0 - smoothstep(7.0, 10.0, abs(xz.x)));
          float worn = max(trail, homePath);
          vec3 finalColor = mix(grass, dirtColor * (0.9 + noise(xz * 4.0) * 0.2), worn);

          vec3 sunDir = normalize(sunDirection);
          float diff = max(0.3, dot(vNormal, sunDir));
          gl_FragColor = vec4(finalColor * lightTint * lightLevel * (diff * 0.75 + 0.35), 1.0);
        }
      `
    });

    this.terrainMaterial = terrainMat;
    this.groundMesh = new THREE.Mesh(geo, terrainMat);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }

}
