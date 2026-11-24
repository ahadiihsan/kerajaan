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
    // 1. Soft Hemisphere Ambient (Warm sky + earth bounce)
    this.hemiLight = new THREE.HemisphereLight(0xdeeeff, 0x5a4533, 1.05);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // 2. Warm Directional Sunlight
    this.dirLight = new THREE.DirectionalLight(0xfff3dc, 2.2);
    this.dirLight.position.set(55, 85, 48);
    this.dirLight.castShadow = true;

    // Mobile-friendly shadow map
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 240;

    const d = 85;
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
    const fogColor = new THREE.Color(0xbdd6e8);
    this.scene.background = fogColor;
    this.scene.fog = new THREE.FogExp2(fogColor.getHex(), 0.0065);

    // Atmospheric warm sky dome
    const skyGeo = new THREE.SphereGeometry(380, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x32618d) },
        horizonColor: { value: new THREE.Color(0xbdd6e8) },
        sunPosition: { value: new THREE.Vector3(55, 85, 48).normalize() },
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
          sky += vec3(1.0, 0.94, 0.8) * pow(sunGlow, 24.0) * 0.45;
          gl_FragColor = vec4(sky, 1.0);
        }
      `
    });

    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
  }

  private setupTerrain(): void {
    const size = 320;
    const segments = 64;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const distFromCenter = Math.sqrt(x * x + z * z);

      if (distFromCenter > 60) {
        const factor = Math.min(1.0, (distFromCenter - 60) / 75);
        const hill = (Math.sin(x * 0.04) * Math.cos(z * 0.04) * 5.0 +
                      Math.sin(x * 0.02 + 1.0) * 7.0) * factor;
        pos.setY(i, Math.max(0, hill));
      } else {
        pos.setY(i, 0);
      }
    }
    geo.computeVertexNormals();

    // Natural weathered cobblestone, rich meadow grass, and warm loam pathways
    const terrainMat = new THREE.ShaderMaterial({
      uniforms: {
        grassColor: { value: new THREE.Color(0x50793a) },
        grassDarkColor: { value: new THREE.Color(0x385726) },
        dirtColor: { value: new THREE.Color(0x75604b) },
        stoneColor: { value: new THREE.Color(0x9a9184) },
        stoneDarkColor: { value: new THREE.Color(0x7e7568) },
        mortarColor: { value: new THREE.Color(0x5a5146) },
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

          // Organic meadow grass with gentle noise
          float gn = noise(xz * 0.22) * 0.7 + noise(xz * 0.5) * 0.3;
          vec3 grass = mix(grassDarkColor, grassColor, gn);

          // Central Plaza & Main thoroughfares
          float inPlaza = smoothstep(25.0, 21.0, dist);
          float streetNS = smoothstep(5.0, 3.5, abs(xz.x)) * smoothstep(68.0, 18.0, abs(xz.y));
          float streetEW = smoothstep(4.5, 3.2, abs(xz.y)) * smoothstep(65.0, 18.0, abs(xz.x));
          float roadFactor = max(inPlaza, max(streetNS, streetEW));

          // Natural weathered cobblestone masonry pattern
          vec2 uvP = xz * 0.75;
          if (mod(floor(uvP.y), 2.0) > 0.5) {
            uvP.x += 0.5;
          }
          vec2 tileId = floor(uvP);
          vec2 tileUv = fract(uvP) - 0.5;

          float stoneVariation = hash(tileId);
          vec3 paver = mix(stoneColor, stoneDarkColor, stoneVariation * 0.65);

          // Soft mortar lines between pavers
          float edge = max(abs(tileUv.x), abs(tileUv.y));
          float mortarGap = smoothstep(0.38, 0.48, edge);
          vec3 cobble = mix(paver, mortarColor, mortarGap);

          // Warm dirt border blending into grass
          float dirtBorder = smoothstep(6.5, 4.2, abs(xz.x)) * 0.45 + smoothstep(6.0, 3.8, abs(xz.y)) * 0.45;
          vec3 streetBlend = mix(dirtColor, cobble, roadFactor);

          vec3 finalColor = mix(grass, streetBlend, clamp(roadFactor + dirtBorder * 0.65, 0.0, 1.0));

          // Soft directional sunlight calculation
          vec3 sunDir = normalize(vec3(55.0, 85.0, 48.0));
          float diff = max(0.3, dot(vNormal, sunDir));
          gl_FragColor = vec4(finalColor * (diff * 0.75 + 0.35), 1.0);
        }
      `
    });

    this.groundMesh = new THREE.Mesh(geo, terrainMat);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }
}
