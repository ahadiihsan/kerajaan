import * as THREE from 'three';

export class Environment {
  private scene: THREE.Scene;
  public dirLight!: THREE.DirectionalLight;
  public hemiLight!: THREE.HemisphereLight;
  public groundMesh!: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupLighting();
    this.setupSkyAndFog();
    this.setupTerrain();
  }

  private setupLighting(): void {
    // 1. Hemisphere Light (Soft ambient sky + ground bounce)
    this.hemiLight = new THREE.HemisphereLight(0xdbe9f6, 0x4a3a2a, 0.9);
    this.hemiLight.position.set(0, 60, 0);
    this.scene.add(this.hemiLight);

    // 2. Directional Sun Light (Warm golden medieval sun)
    this.dirLight = new THREE.DirectionalLight(0xfff4db, 2.3);
    this.dirLight.position.set(65, 95, 55);
    this.dirLight.castShadow = true;

    // High quality shadow configuration
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 320;

    const d = 115;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;

    this.dirLight.shadow.bias = -0.0003;
    this.dirLight.shadow.normalBias = 0.035;

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);
  }

  private setupSkyAndFog(): void {
    const fogColor = new THREE.Color(0xaecde6);
    this.scene.background = fogColor;
    this.scene.fog = new THREE.FogExp2(fogColor.getHex(), 0.0065);

    // Atmospheric Sky Dome with rich vertical gradient & subtle sun haze
    const skyGeo = new THREE.SphereGeometry(450, 32, 24);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x38658d) },
        horizonColor: { value: new THREE.Color(0xaecde6) },
        sunPosition: { value: new THREE.Vector3(65, 95, 55).normalize() },
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
          vec3 sky = mix(horizonColor, topColor, pow(h, 0.55));
          float sunGlow = max(0.0, dot(dir, sunPosition));
          sky += vec3(1.0, 0.92, 0.75) * pow(sunGlow, 28.0) * 0.45;
          gl_FragColor = vec4(sky, 1.0);
        }
      `
    });

    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
  }

  private setupTerrain(): void {
    const size = 380;
    const segments = 120;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const distFromCenter = Math.sqrt(x * x + z * z);

      // Village center (r < 65) is flat and walkable
      if (distFromCenter > 65) {
        const factor = Math.min(1.0, (distFromCenter - 65) / 90);
        const hill = (Math.sin(x * 0.035) * Math.cos(z * 0.035) * 5.5 +
                      Math.sin(x * 0.015 + 1.2) * 8.5) * factor;
        pos.setY(i, Math.max(0, hill));
      } else {
        pos.setY(i, 0);
      }
    }
    geo.computeVertexNormals();

    // Load kit textures for genuine cobblestone blending
    const textureLoader = new THREE.TextureLoader();
    const brickTex = textureLoader.load('/assets/medieval/T_Brick_BaseColor.png');
    brickTex.wrapS = THREE.RepeatWrapping;
    brickTex.wrapT = THREE.RepeatWrapping;

    const brickNormal = textureLoader.load('/assets/medieval/T_Brick_Normal.png');
    brickNormal.wrapS = THREE.RepeatWrapping;
    brickNormal.wrapT = THREE.RepeatWrapping;

    const terrainMat = new THREE.ShaderMaterial({
      uniforms: {
        tBrick: { value: brickTex },
        tBrickNormal: { value: brickNormal },
        grassColor: { value: new THREE.Color(0x3e652a) },
        grassDarkColor: { value: new THREE.Color(0x2d4d1d) },
        dirtColor: { value: new THREE.Color(0x6b533e) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec2 vUv;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tBrick;
        uniform sampler2D tBrickNormal;
        uniform vec3 grassColor;
        uniform vec3 grassDarkColor;
        uniform vec3 dirtColor;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec2 vUv;

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

          // Authentic stone texture sampled with seamless tiling
          vec4 stoneSample = texture2D(tBrick, xz * 0.22);
          vec3 stoneColor = stoneSample.rgb * 0.95;

          // Organic grass with procedural noise variation
          float gn = noise(xz * 0.18) * 0.7 + noise(xz * 0.45) * 0.3;
          vec3 grass = mix(grassDarkColor, grassColor, gn);

          // Central plaza circle & connected streets
          float inPlaza = smoothstep(26.0, 22.0, dist);
          float streetNS = smoothstep(5.5, 3.8, abs(xz.x)) * smoothstep(72.0, 20.0, abs(xz.y));
          float streetEW = smoothstep(5.0, 3.5, abs(xz.y)) * smoothstep(68.0, 20.0, abs(xz.x));
          float roadFactor = max(inPlaza, max(streetNS, streetEW));

          // Dirt path borders
          float dirtBorder = smoothstep(7.0, 4.5, abs(xz.x)) * 0.5 + smoothstep(6.5, 4.0, abs(xz.y)) * 0.5;
          vec3 pavedStreet = mix(dirtColor, stoneColor, roadFactor);

          vec3 finalColor = mix(grass, pavedStreet, clamp(roadFactor + dirtBorder * 0.65, 0.0, 1.0));

          // Soft lighting calculation
          vec3 sunDir = normalize(vec3(65.0, 95.0, 55.0));
          float diff = max(0.28, dot(vNormal, sunDir));
          gl_FragColor = vec4(finalColor * (diff * 0.75 + 0.35), 1.0);
        }
      `
    });

    this.groundMesh = new THREE.Mesh(geo, terrainMat);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }
}
