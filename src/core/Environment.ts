import * as THREE from 'three';

export class Environment {
  private scene: THREE.Scene;
  public dirLight!: THREE.DirectionalLight;
  public hemiLight!: THREE.HemisphereLight;
  public groundMesh!: THREE.Mesh;
  public lanterns: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupLighting();
    this.setupSkyAndFog();
    this.setupTerrain();
    this.setupStreetLanterns();
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
        uniform vec3 sunPosition;
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = max(0.0, dir.y);
          vec3 sky = mix(horizonColor, topColor, pow(h, 0.6));
          float sunGlow = max(0.0, dot(dir, sunPosition));
          sky += vec3(1.0, 0.92, 0.75) * pow(sunGlow, 24.0) * 0.4;
          gl_FragColor = vec4(sky, 1.0);
        }
      `
    });

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

      if (distFromCenter > 50) {
        const factor = Math.min(1.0, (distFromCenter - 50) / 60);
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
        grassColor: { value: new THREE.Color(0x4a7436) },
        grassDarkColor: { value: new THREE.Color(0x355424) },
        dirtColor: { value: new THREE.Color(0x735c46) },
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
          float gn = noise(xz * 0.25) * 0.7 + noise(xz * 0.55) * 0.3;
          vec3 grass = mix(grassDarkColor, grassColor, gn);

          // Central Plaza & Main streets
          float inPlaza = smoothstep(23.0, 19.0, dist);
          float streetNS = smoothstep(4.8, 3.2, abs(xz.x)) * smoothstep(58.0, 16.0, abs(xz.y));
          float streetEW = smoothstep(4.2, 3.0, abs(xz.y)) * smoothstep(55.0, 16.0, abs(xz.x));
          float roadFactor = max(inPlaza, max(streetNS, streetEW));

          // Cobblestones
          vec2 uvP = xz * 0.85;
          if (mod(floor(uvP.y), 2.0) > 0.5) {
            uvP.x += 0.5;
          }
          vec2 tileId = floor(uvP);
          vec2 tileUv = fract(uvP) - 0.5;

          float stoneVariation = hash(tileId);
          vec3 paver = mix(stoneColor, stoneDarkColor, stoneVariation * 0.6);

          float edge = max(abs(tileUv.x), abs(tileUv.y));
          float mortarGap = smoothstep(0.38, 0.48, edge);
          vec3 cobble = mix(paver, mortarColor, mortarGap);

          // Soft dirt borders
          float dirtBorder = smoothstep(6.0, 3.8, abs(xz.x)) * 0.4 + smoothstep(5.5, 3.4, abs(xz.y)) * 0.4;
          vec3 streetBlend = mix(dirtColor, cobble, roadFactor);

          vec3 finalColor = mix(grass, streetBlend, clamp(roadFactor + dirtBorder * 0.6, 0.0, 1.0));

          vec3 sunDir = normalize(vec3(30.0, 65.0, 35.0));
          float diff = max(0.3, dot(vNormal, sunDir));
          gl_FragColor = vec4(finalColor * (diff * 0.75 + 0.35), 1.0);
        }
      `
    });

    this.groundMesh = new THREE.Mesh(geo, terrainMat);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }

  private setupStreetLanterns(): void {
    // Warm atmospheric point lights (The signature Octopath traveler lantern glow)
    const lanternCoords = [
      { x: -6, z: -6 },
      { x: 6, z: -6 },
      { x: -6, z: 6 },
      { x: 6, z: 6 },
      { x: -16, z: 0 },
      { x: 16, z: 0 },
      { x: 0, z: -18 },
      { x: 0, z: 22 },
    ];

    lanternCoords.forEach((coord) => {
      const light = new THREE.PointLight(0xffa638, 2.5, 14);
      light.position.set(coord.x, 2.2, coord.z);
      this.scene.add(light);
      this.lanterns.push(light);
    });
  }
}
