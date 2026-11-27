import * as THREE from 'three';
import { lerp, pick, R, smooth, V3 } from '../utils/math';
import { PCW, WATER_Y, WorldGrid } from '../world/WorldGrid';
import type { WorldBuildings } from '../world/Buildings';
import type { AudioEngine } from './AudioEngine';
import { world } from './WorldState';

export class Pool {
  public readonly max: number;
  public n = 0;
  public readonly p: Float32Array;
  public readonly c: Float32Array;
  public readonly sz: Float32Array;
  public readonly al: Float32Array;
  public readonly v: Float32Array;
  public readonly life: Float32Array;
  public readonly ml: Float32Array;
  public readonly gr: Float32Array;
  public readonly dr: Float32Array;
  public readonly gw: Float32Array;
  public readonly bs: Float32Array;
  public readonly a0: Float32Array;
  public readonly geo: THREE.BufferGeometry;
  public readonly mat: THREE.ShaderMaterial;
  public readonly pts: THREE.Points;

  constructor(scene: THREE.Scene, max: number, additive: boolean, soft: number) {
    this.max = max;
    this.p = new Float32Array(max * 3);
    this.c = new Float32Array(max * 3);
    this.sz = new Float32Array(max);
    this.al = new Float32Array(max);
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.ml = new Float32Array(max);
    this.gr = new Float32Array(max);
    this.dr = new Float32Array(max);
    this.gw = new Float32Array(max);
    this.bs = new Float32Array(max);
    this.a0 = new Float32Array(max);

    const g = (this.geo = new THREE.BufferGeometry());
    for (const [name, arr, s] of [
      ['position', this.p, 3],
      ['pcol', this.c, 3],
      ['psize', this.sz, 1],
      ['palpha', this.al, 1],
    ] as const) {
      g.setAttribute(name, new THREE.BufferAttribute(arr, s).setUsage(THREE.DynamicDrawUsage));
    }
    this.mat = new THREE.ShaderMaterial({
      uniforms: { pr: { value: 1 }, soft: { value: soft } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec3 pcol; attribute float psize, palpha; uniform float pr; varying vec3 vC; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=psize*pr*(300./-mv.z); vC=pcol; vA=palpha; }`,
      fragmentShader: `uniform float soft; varying vec3 vC; varying float vA; void main(){ float r=length(gl_PointCoord-.5); if(r>.5) discard; float a=mix(1.,smoothstep(.5,0.,r),soft); gl_FragColor=vec4(vC,vA*a); }`,
    });
    this.pts = new THREE.Points(g, this.mat);
    this.pts.frustumCulled = false;
    this.pts.renderOrder = 3;
    scene.add(this.pts);
  }

  public spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    r: number,
    g: number,
    b: number,
    size: number,
    life: number,
    grav = 0,
    drag = 0,
    grow = 0,
    a0 = 1
  ): void {
    if (this.n >= this.max) return;
    const i = this.n++;
    const i3 = i * 3;
    this.p[i3] = x;
    this.p[i3 + 1] = y;
    this.p[i3 + 2] = z;
    this.v[i3] = vx;
    this.v[i3 + 1] = vy;
    this.v[i3 + 2] = vz;
    this.c[i3] = r;
    this.c[i3 + 1] = g;
    this.c[i3 + 2] = b;
    this.bs[i] = this.sz[i] = size;
    this.life[i] = this.ml[i] = life;
    this.gr[i] = grav;
    this.dr[i] = drag;
    this.gw[i] = grow;
    this.a0[i] = this.al[i] = a0;
  }

  public update(dt: number): void {
    for (let i = 0; i < this.n; i++) {
      if ((this.life[i] -= dt) <= 0) {
        const j = --this.n;
        if (i !== j) this.copy(j, i);
        i--;
        continue;
      }
      const i3 = i * 3;
      const f = 1 - this.dr[i] * dt;
      this.v[i3 + 1] -= this.gr[i] * dt;
      this.v[i3] *= f;
      this.v[i3 + 1] *= f;
      this.v[i3 + 2] *= f;
      this.p[i3] += this.v[i3] * dt;
      this.p[i3 + 1] += this.v[i3 + 1] * dt;
      this.p[i3 + 2] += this.v[i3 + 2] * dt;
      const t = this.life[i] / this.ml[i];
      this.al[i] = this.a0[i] * Math.min(1, t * 1.6);
      this.sz[i] = Math.max(0.01, this.bs[i] * (1 + this.gw[i] * (1 - t)));
    }
    const g = this.geo;
    g.setDrawRange(0, this.n);
    for (const k in g.attributes) g.attributes[k].needsUpdate = true;
  }

  private copy(a: number, b: number): void {
    for (const arr of [this.p, this.c, this.v]) {
      arr[b * 3] = arr[a * 3];
      arr[b * 3 + 1] = arr[a * 3 + 1];
      arr[b * 3 + 2] = arr[a * 3 + 2];
    }
    for (const arr of [this.sz, this.al, this.life, this.ml, this.gr, this.dr, this.gw, this.bs, this.a0]) {
      arr[b] = arr[a];
    }
  }
}

export interface FirePatch {
  x: number;
  y: number;
  z: number;
  t: number;
}

export interface Rocket {
  p: THREE.Vector3;
  v: THREE.Vector3;
  fuse: number;
  c: [number, number, number];
}

export class ParticleSystem {
  public readonly fxAdd: Pool;
  public readonly fxNorm: Pool;
  public readonly fires: FirePatch[] = [];
  public readonly rockets: Rocket[] = [];
  private fwCD = 1;
  private smokeCD = 0;

  constructor(scene: THREE.Scene) {
    this.fxAdd = new Pool(scene, 5000, true, 1);
    this.fxNorm = new Pool(scene, 2500, false, 0.55);
  }

  public update(
    dt: number,
    opts: {
      grid: WorldGrid;
      buildings: WorldBuildings;
      camTarget: THREE.Vector3;
      bonLight: THREE.PointLight;
      fireLight: THREE.PointLight;
      dragonFlash: number;
      dragonBreathing: number;
      dragonTarget: THREE.Vector3;
      audio: AudioEngine;
      onStrike: () => void;
      bolt: THREE.Mesh;
    }
  ): void {
    const T = world.T;
    const { buildings, grid, camTarget, bonLight, fireLight, audio } = opts;

    if ((this.smokeCD -= dt) <= 0 && buildings.chimneys.length > 0) {
      this.smokeCD = 0.28;
      const s = pick(buildings.chimneys);
      const k = lerp(0.25, 0.85, world.dayness);
      this.fxNorm.spawn(
        s.x + R(-0.1, 0.1),
        s.y,
        s.z + R(-0.1, 0.1),
        R(0.1, 0.4),
        R(0.6, 1),
        R(-0.1, 0.1),
        k * 0.8,
        k * 0.8,
        k * 0.82,
        R(0.9, 1.3),
        R(3, 4.5),
        -0.05,
        0.3,
        2.6,
        0.4
      );
    }

    if (Math.random() < dt * 6) {
      this.fxAdd.spawn(
        buildings.forge.anvil.x - 0.5 + R(-0.3, 0.3),
        buildings.forge.anvil.y + 0.2,
        buildings.forge.anvil.z + R(-0.3, 0.3),
        R(-0.2, 0.2),
        R(0.6, 1.4),
        R(-0.2, 0.2),
        2.5,
        1,
        0.2,
        R(0.2, 0.4),
        R(0.8, 1.5),
        -0.4,
        0.4
      );
    }

    if (Math.random() < dt * 14) {
      this.fxNorm.spawn(
        buildings.mill.splash.x + R(-0.25, 0.25),
        WATER_Y + 0.05,
        buildings.mill.splash.z + R(-1, 1),
        R(-0.4, 0.4),
        R(1, 2.4),
        R(-0.6, 0.6),
        0.85,
        0.92,
        1,
        R(0.3, 0.6),
        R(0.4, 0.8),
        6,
        0.5,
        0.5,
        0.8
      );
    }

    const rs = smooth(0.4, 0.8, world.weather);
    for (let k = 0; k < rs * 6; k++) {
      const x = camTarget.x + R(-24, 24);
      const z = camTarget.z + R(-24, 24);
      this.fxNorm.spawn(x, grid.groundY(x, z) + 0.03, z, 0, R(0.8, 1.6), 0, 0.7, 0.75, 0.85, R(0.25, 0.45), 0.25, 9, 0, 1, 0.55);
    }

    bonLight.intensity = world.festival ? 22 + Math.sin(T * 11) * 4 + Math.sin(T * 6.3) * 3 : 0;
    if (world.festival) {
      for (let k = 0; k < 4; k++) {
        this.fxAdd.spawn(
          PCW.x + R(-0.35, 0.35),
          PCW.y + 0.2,
          PCW.z + R(-0.35, 0.35),
          R(-0.25, 0.25),
          R(1.6, 3),
          R(-0.25, 0.25),
          3,
          R(0.9, 1.5),
          0.25,
          R(0.9, 1.6),
          R(0.6, 1.1),
          -0.6,
          0.6,
          -0.4
        );
      }
      if (Math.random() < dt * 8) {
        this.fxAdd.spawn(PCW.x, PCW.y + 0.8, PCW.z, R(-0.6, 0.6), R(2, 4), R(-0.6, 0.6), 3, 1.4, 0.3, R(0.25, 0.45), R(1.5, 2.6), 0.2, 0.2);
      }
      if ((this.fwCD -= dt) <= 0) {
        this.fwCD = R(0.6, 1.5);
        this.rockets.push({
          p: new V3(PCW.x + R(-4, 4), PCW.y + 0.5, PCW.z + R(-4, 4)),
          v: new V3(R(-1, 1), R(14, 19), R(-1, 1)),
          fuse: R(0.9, 1.25),
          c: pick([
            [3, 0.7, 0.6],
            [3, 2.4, 0.6],
            [0.8, 3, 1.2],
            [0.9, 1.6, 3.2],
            [2.6, 1, 3],
          ]),
        });
        audio.launch();
      }
    }

    for (let r = this.rockets.length - 1; r >= 0; r--) {
      const k = this.rockets[r];
      k.v.y -= 9 * dt;
      k.p.addScaledVector(k.v, dt);
      k.fuse -= dt;
      this.fxAdd.spawn(k.p.x, k.p.y, k.p.z, R(-0.3, 0.3), R(-1, 0), R(-0.3, 0.3), 2.4, 1.6, 0.8, 0.5, 0.4, 2, 0.5);
      if (k.fuse <= 0) {
        this.rockets.splice(r, 1);
        world.flash = Math.max(world.flash, 0.12);
        for (let n = 0; n < 90; n++) {
          const d = new V3(R(-1, 1), R(-1, 1), R(-1, 1)).normalize().multiplyScalar(R(6, 9));
          const white = Math.random() < 0.2;
          this.fxAdd.spawn(
            k.p.x,
            k.p.y,
            k.p.z,
            d.x,
            d.y,
            d.z,
            white ? 3 : k.c[0],
            white ? 3 : k.c[1],
            white ? 3 : k.c[2],
            R(1.2, 1.9),
            R(1.1, 1.9),
            3.5,
            1.4
          );
        }
        audio.pop();
      }
    }

    let fl = 0;
    for (let n = this.fires.length - 1; n >= 0; n--) {
      const f = this.fires[n];
      f.t -= dt;
      if (f.t <= 0) {
        this.fires.splice(n, 1);
        continue;
      }
      const s = Math.min(1, f.t / 2);
      for (let k = 0; k < 3; k++) {
        this.fxAdd.spawn(
          f.x + R(-0.6, 0.6),
          f.y + 0.1,
          f.z + R(-0.6, 0.6),
          R(-0.3, 0.3),
          R(1.5, 3.4),
          R(-0.3, 0.3),
          3,
          R(0.8, 1.5),
          0.2,
          R(1, 1.8) * s,
          R(0.5, 1),
          -0.5,
          0.5,
          -0.3
        );
      }
      if (Math.random() < dt * 6) {
        this.fxNorm.spawn(f.x, f.y + 1.2, f.z, R(-0.2, 0.2), R(0.8, 1.5), R(-0.2, 0.2), 0.15, 0.13, 0.12, 1.4, 3, -0.1, 0.3, 2.5, 0.5);
      }
      fl = Math.max(fl, s);
      fireLight.position.set(f.x, f.y + 1.5, f.z);
    }
    fireLight.intensity = fl * (26 + Math.sin(T * 17) * 6) + opts.dragonFlash * 30;
    if (opts.dragonBreathing > 0) fireLight.position.copy(opts.dragonTarget).add(new V3(0, 2, 0));

    if (world.raid && Math.random() < dt * 10) {
      const x = PCW.x + R(-14, 14);
      const z = PCW.z + R(-14, 14);
      this.fxAdd.spawn(x, grid.groundY(x, z) + R(0, 3), z, R(-0.3, 0.3), R(0.5, 1.5), R(-0.3, 0.3), 2.6, 0.9, 0.2, R(0.25, 0.5), R(2, 3.5), -0.1, 0.1);
    }

    if (world.weather > 0.72) {
      if ((world.lightCD -= dt) <= 0) opts.onStrike();
    } else {
      world.lightCD = Math.max(world.lightCD, 1);
    }
    if (world.boltT > 0) {
      world.boltT -= dt;
      opts.bolt.visible = world.boltT > 0 && Math.floor(world.boltT * 40) % 3 !== 0;
    } else {
      opts.bolt.visible = false;
    }
    world.flash *= Math.exp(-dt * 6);
    this.fxAdd.update(dt);
    this.fxNorm.update(dt);
  }
}
