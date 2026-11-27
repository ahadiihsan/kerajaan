import * as THREE from 'three';
import { clamp, lerp, pick, R, rand, smooth, V3 } from '../utils/math';
import { PCW, WorldGrid, wx, wz } from '../world/WorldGrid';
import type { WorldBuildings } from '../world/Buildings';
import type { SharedMaterials } from '../world/Textures';
import type { AudioEngine } from './AudioEngine';
import type { FirePatch } from './Particles';
import { world } from './WorldState';

const C = (h: string) => new THREE.Color(h);

const PAL = {
  night: { top: C('#060a1c'), hor: C('#1c2754'), bot: C('#0a0f2a'), sun: C('#8ea6ff'), si: 1.1, hs: C('#5a6cc0'), hg: C('#10121f'), hi: 1.0 },
  gold: { top: C('#3d4f8f'), hor: C('#ff9a5a'), bot: C('#4a2f52'), sun: C('#ffae66'), si: 3.1, hs: C('#ffd3a3'), hg: C('#4a3226'), hi: 1.5 },
  day: { top: C('#3f86d8'), hor: C('#bfe3ff'), bot: C('#6f9fd0'), sun: C('#fff2d8'), si: 3.5, hs: C('#d9ecff'), hg: C('#6b7a45'), hi: 1.9 },
  storm: { top: C('#2c323e'), hor: C('#5d6675'), bot: C('#22272f'), sun: C('#b8c4d8'), si: 1, hs: C('#8c96a8'), hg: C('#2a2e36'), hi: 1 },
  stormN: { top: C('#07080d'), hor: C('#161a26'), bot: C('#06070b'), sun: C('#7080a0'), si: 1, hs: C('#2a3348'), hg: C('#0a0b10'), hi: 1 },
};

type PalEntry = typeof PAL.day;

function mixPal(out: PalEntry, A: PalEntry, B: PalEntry, t: number): void {
  for (const k of ['top', 'hor', 'bot', 'sun', 'hs', 'hg'] as const) {
    out[k].copy(A[k]).lerp(B[k], t);
  }
  out.si = lerp(A.si, B.si, t);
  out.hi = lerp(A.hi, B.hi, t);
}

export class Environment {
  public readonly hemi: THREE.HemisphereLight;
  public readonly sun: THREE.DirectionalLight;
  public readonly bonLight: THREE.PointLight;
  public readonly fireLight: THREE.PointLight;
  public readonly skyGroup: THREE.Group;
  public readonly skyMat: THREE.ShaderMaterial;
  public readonly stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  public readonly fireflies: { pts: THREE.Points; m: THREE.ShaderMaterial };
  public readonly rain: { l: THREE.LineSegments; m: THREE.ShaderMaterial };
  public readonly bolt: THREE.Mesh;
  public readonly sunDir = new V3();
  public readonly tint = new V3(1, 1, 1);
  public readonly spriteTint = new THREE.Color();

  private readonly E: PalEntry = {
    top: new THREE.Color(),
    hor: new THREE.Color(),
    bot: new THREE.Color(),
    sun: new THREE.Color(),
    hs: new THREE.Color(),
    hg: new THREE.Color(),
    si: 1,
    hi: 1,
  };
  private readonly ES: PalEntry = {
    top: new THREE.Color(),
    hor: new THREE.Color(),
    bot: new THREE.Color(),
    sun: new THREE.Color(),
    hs: new THREE.Color(),
    hg: new THREE.Color(),
    si: 1,
    hi: 1,
  };
  private readonly tmpC = new THREE.Color();
  private readonly grid: WorldGrid;

  constructor(scene: THREE.Scene, grid: WorldGrid) {
    this.grid = grid;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1.6);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 170 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);

    this.bonLight = new THREE.PointLight(0xff8a3a, 0, 14, 2);
    this.bonLight.position.copy(PCW).add(new V3(0, 1.2, 0));
    scene.add(this.bonLight);

    this.fireLight = new THREE.PointLight(0xff6a20, 0, 16, 2);
    scene.add(this.fireLight);

    this.skyGroup = new THREE.Group();
    scene.add(this.skyGroup);

    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform vec3 top,hor,bot; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0. ? mix(hor,top,pow(smoothstep(0.,.65,h),.8)) : mix(hor,bot,smoothstep(-.02,-.85,h)); gl_FragColor=vec4(c,1.); }`,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), this.skyMat);
    skyDome.renderOrder = -2;
    this.skyGroup.add(skyDome);

    this.stars = (() => {
      const p: number[] = [];
      for (let k = 0; k < 900; k++) {
        const v = new V3(R(-1, 1), R(-1, 1), R(-1, 1)).normalize().multiplyScalar(470);
        p.push(v.x, v.y, v.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      const s = new THREE.Points(
        g,
        new THREE.PointsMaterial({
          size: 1.1,
          sizeAttenuation: false,
          color: 0xfff6dd,
          transparent: true,
          opacity: 0,
          fog: false,
          depthWrite: false,
        })
      );
      s.renderOrder = -1;
      this.skyGroup.add(s);
      return s;
    })();

    this.fireflies = (() => {
      const n = 420;
      const p: number[] = [];
      const s: number[] = [];
      for (let k = 0; k < n; k++) {
        const [i, j] = pick(grid.reachList.length ? grid.reachList : [[22, 22]]);
        const x = wx(i) + R(-6, 6);
        const z = wz(j) + R(-6, 6);
        p.push(x, grid.groundY(x, z) + R(0.3, 2.6), z);
        s.push(rand(), rand(), rand());
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('seed', new THREE.Float32BufferAttribute(s, 3));
      const m = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, night: { value: 0 }, opac: { value: 1 }, pr: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `attribute vec3 seed; uniform float time,night,opac,pr; varying float vA; varying vec3 vC;
          void main(){ vec3 p=position; float t=time*.35+seed.x*6.283;
            p.x+=sin(t*1.3+seed.y*10.)*1.3; p.z+=cos(t*1.1+seed.z*10.)*1.3; p.y+=sin(t*.9+seed.x*5.)*.6;
            vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
            float pulse=pow(.5+.5*sin(time*2.6+seed.y*40.),3.);
            vA=mix(.35,pulse*1.6,night)*opac; vC=mix(vec3(1.,.95,.75),vec3(.75,1.,.3),night);
            gl_PointSize=mix(2.2,5.5,night)*pr*(60./-mv.z)*(.7+seed.z*.6); }`,
        fragmentShader: `varying float vA; varying vec3 vC; void main(){ float r=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,r); gl_FragColor=vec4(vC*a*a*vA*2.,a*vA); }`,
      });
      const pts = new THREE.Points(g, m);
      pts.frustumCulled = false;
      pts.renderOrder = 4;
      scene.add(pts);
      return { pts, m };
    })();

    this.rain = (() => {
      const n = 3200;
      const p: number[] = [];
      const s: number[] = [];
      const e: number[] = [];
      for (let k = 0; k < n; k++) {
        const a = [rand(), rand(), rand()];
        for (const end of [0, 1]) {
          p.push(0, 0, 0);
          s.push(...a);
          e.push(end);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('seed', new THREE.Float32BufferAttribute(s, 3));
      g.setAttribute('endp', new THREE.Float32BufferAttribute(e, 1));
      const m = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, opac: { value: 0 }, center: { value: new V3() } },
        transparent: true,
        depthWrite: false,
        vertexShader: `attribute vec3 seed; attribute float endp; uniform float time,opac; uniform vec3 center; varying float vA;
          void main(){ float Hh=32.; vec3 p; p.x=center.x+(seed.x-.5)*70.; p.z=center.z+(seed.z-.5)*70.;
            p.y=mod(seed.y*Hh-time*(24.+seed.x*8.),Hh)-2.; p.x+=endp*.35; p.y+=endp*1.1;
            vA=opac*(.2+.6*endp); gl_Position=projectionMatrix*viewMatrix*vec4(p,1.); }`,
        fragmentShader: `varying float vA; void main(){ gl_FragColor=vec4(.72,.8,.95,vA); }`,
      });
      const l = new THREE.LineSegments(g, m);
      l.frustumCulled = false;
      l.renderOrder = 5;
      scene.add(l);
      return { l, m };
    })();

    this.bolt = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: 0xdfe8ff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      })
    );
    this.bolt.visible = false;
    scene.add(this.bolt);
  }

  public buildBolt(): void {
    const x = R(-18, 18);
    const z = R(-18, 18);
    const pts: THREE.Vector3[] = [];
    const px = x + R(-6, 6);
    const pz = z + R(-6, 6);
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      pts.push(
        new V3(
          lerp(px, x, t) + (k && k < 16 ? R(-1.2, 1.2) : 0),
          lerp(42, this.grid.groundY(x, z), t),
          lerp(pz, z, t) + (k && k < 16 ? R(-1.2, 1.2) : 0)
        )
      );
    }
    const p: number[] = [];
    const w = 0.22;
    for (let k = 0; k < 16; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      for (const [ox, oz] of [
        [w, 0],
        [0, w],
      ]) {
        p.push(
          a.x - ox, a.y, a.z - oz,
          a.x + ox, a.y, a.z + oz,
          b.x + ox, b.y, b.z + oz,
          a.x - ox, a.y, a.z - oz,
          b.x + ox, b.y, b.z + oz,
          b.x - ox, b.y, b.z - oz
        );
      }
    }
    this.bolt.geometry.dispose();
    this.bolt.geometry = new THREE.BufferGeometry();
    this.bolt.geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  }

  public strike(audio: AudioEngine): void {
    world.lightCD = R(1.6, 5) * (1.7 - world.weather);
    world.flash = 1.15;
    world.boltT = 0.22;
    this.buildBolt();
    audio.thunder(R(0.15, 0.9));
  }

  public applyEnvironment(
    dt: number,
    scene: THREE.Scene,
    buildings: WorldBuildings,
    MAT: SharedMaterials,
    audio: AudioEngine
  ): void {
    const a = ((world.time - 6) / 12) * Math.PI;
    const h = Math.sin(a);
    const w = world.weather;
    if (h < 0.02) mixPal(this.E, PAL.night, PAL.gold, smooth(-0.28, 0.02, h));
    else mixPal(this.E, PAL.gold, PAL.day, smooth(0.04, 0.5, h));
    const dayness = smooth(-0.15, 0.3, h);
    const ws = smooth(0.15, 0.85, w);
    mixPal(this.ES, PAL.stormN, PAL.storm, dayness);
    for (const k of ['top', 'hor', 'bot', 'sun', 'hs', 'hg'] as const) {
      this.E[k].lerp(this.ES[k], ws * 0.85);
    }
    world.night = 1 - smooth(-0.22, 0.1, h);
    world.dayness = dayness;
    world.storm = ws;
    world.golden = smooth(-0.25, 0.02, h) * (1 - smooth(0.08, 0.5, h));
    world.glow = clamp(Math.max(world.night, ws * 0.75 * (1 - world.night * 0.2)), 0, 1);

    this.skyMat.uniforms.top.value.copy(this.E.top);
    this.skyMat.uniforms.hor.value.copy(this.E.hor);
    this.skyMat.uniforms.bot.value.copy(this.E.bot);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(this.E.bot).lerp(this.E.hor, 0.5);
      scene.fog.near = 95 - ws * 45;
      scene.fog.far = 230 - ws * 100;
    }
    this.hemi.color.copy(this.E.hs);
    this.hemi.groundColor.copy(this.E.hg);
    this.hemi.intensity = this.E.hi * (1 - 0.3 * ws) + world.flash * 3;
    const s = h >= 0 ? a : a - Math.PI;
    this.sunDir.set(Math.cos(s) * 0.8, Math.max(Math.sin(s), 0.22), 0.5).normalize();
    this.sun.color.copy(this.E.sun);
    this.sun.intensity = this.E.si * (1 - 0.72 * ws) * smooth(0, 0.1, Math.abs(h)) + world.flash * 1.5;
    this.stars.material.opacity = world.night * (1 - ws) * 0.95;

    const g = world.golden;
    this.tint.set(lerp(1, 1.1, g), lerp(1, 0.97, g), lerp(1, 0.86, g));
    this.tint.x *= lerp(1, 0.86, world.night * 0.7);
    this.tint.y *= lerp(1, 0.94, world.night * 0.7);
    this.tint.z *= lerp(1, 1.14, world.night * 0.7);
    world.raidAmt = lerp(world.raidAmt, world.raid ? 1 : 0, 1 - Math.exp(-dt * 1.5));

    const gl = world.glow;
    const t = world.T;
    for (const { m, phase } of buildings.windowMats) {
      m.emissiveIntensity = gl * 2.3 * (0.88 + 0.12 * Math.sin(t * 7.3 + phase) * Math.sin(t * 3.1 + phase * 2));
    }
    MAT.lantern.emissiveIntensity = gl * 3.2;
    for (const G of buildings.glows) {
      const f = 0.85 + 0.15 * Math.sin(t * 9 + G.phase) * Math.sin(t * 4.3 + G.phase);
      G.s.material.opacity = G.kind === 'forge' ? 0.8 * f : G.kind === 'fest' ? 0.95 * f : gl * G.base * f;
    }
    buildings.houseLights.forEach((l, n) => {
      l.intensity = gl * 14 * (0.9 + 0.1 * Math.sin(t * 8 + n));
    });
    buildings.coneMat.uniforms.amt.value = gl * 0.22;
    buildings.forge.light.intensity = 8 + Math.sin(t * 13) * 2 + Math.sin(t * 7.7) * 1.5;
    this.fireflies.m.uniforms.night.value = world.night;
    this.fireflies.m.uniforms.opac.value = (world.fireflies ? 1 : 0) * (1 - ws * 0.85);
    this.rain.m.uniforms.opac.value = smooth(0.35, 0.75, w) * 0.55;

    this.spriteTint.setRGB(lerp(0.3, 1, dayness), lerp(0.34, 1, dayness), lerp(0.55, 1, dayness));
    this.spriteTint.r *= lerp(1, 1.05, g);
    this.spriteTint.g *= lerp(1, 0.9, g);
    this.spriteTint.b *= lerp(1, 0.78, g);
    this.spriteTint.multiplyScalar(1 - 0.38 * ws * dayness + world.flash * 0.8);
    audio.setWeather(w, world.night);
  }

  public tintActor(
    actor: { x: number; z: number; mat: THREE.MeshBasicMaterial },
    lightSources: THREE.Vector3[],
    fires: FirePatch[]
  ): void {
    this.tmpC.copy(this.spriteTint);
    if (world.glow > 0.05) {
      for (const p of lightSources) {
        const d = Math.hypot(p.x - actor.x, p.z - actor.z);
        if (d < 4.5) {
          const k = (1 - d / 4.5) * world.glow * 0.9;
          this.tmpC.r += k;
          this.tmpC.g += k * 0.62;
          this.tmpC.b += k * 0.3;
        }
      }
    }
    if (world.festival) {
      const d = Math.hypot(PCW.x - actor.x, PCW.z - actor.z);
      if (d < 6) {
        const k = (1 - d / 6) * 0.8;
        this.tmpC.r += k;
        this.tmpC.g += k * 0.55;
        this.tmpC.b += k * 0.2;
      }
    }
    for (const f of fires) {
      const d = Math.hypot(f.x - actor.x, f.z - actor.z);
      if (d < 5) {
        const k = (1 - d / 5) * 0.9;
        this.tmpC.r += k;
        this.tmpC.g += k * 0.45;
        this.tmpC.b += k * 0.15;
      }
    }
    actor.mat.color.copy(this.tmpC);
  }
}
