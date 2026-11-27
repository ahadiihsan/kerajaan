import * as THREE from 'three';
import { lerp, pick, R, RI, V3 } from '../utils/math';
import { cnv, ctex, pixelize } from '../utils/canvas';
import { PCW, WorldGrid } from '../world/WorldGrid';
import type { ParticleSystem } from '../core/Particles';
import type { AudioEngine } from '../core/AudioEngine';
import { world } from '../core/WorldState';
import type { Villager } from './Villager';

export class Dragon {
  public readonly mesh: THREE.Mesh;
  public readonly mat: THREE.MeshBasicMaterial;
  public readonly tex: THREE.CanvasTexture;
  public active = false;
  public phase: 'off' | 'enter' | 'circle' | 'leave' = 'off';
  public theta = 0;
  public radius = 70;
  public y = 22;
  public t = 0;
  public breathCD = 2;
  public breathing = 0;
  public target = new V3();
  public ignited = false;
  public roarCD = 0;
  public pos = new V3();
  public face = 1;
  public flash = 0;

  constructor(scene: THREE.Scene) {
    const [c, x] = cnv(256, 40);
    const wings = [
      [[18, 1], [34, 0], [44, 8]],
      [[10, 11], [38, 4], [46, 14]],
      [[14, 37], [32, 39], [42, 25]],
      [[10, 11], [38, 4], [46, 14]],
    ];
    for (let f = 0; f < 4; f++) {
      const o = f * 64;
      const w = wings[f];
      const poly = (pts: number[][], col: string) => {
        x.fillStyle = col;
        x.beginPath();
        pts.forEach(([a, b], i) => (i ? x.lineTo(o + a, b) : x.moveTo(o + a, b)));
        x.closePath();
        x.fill();
      };
      const ell = (cx: number, cy: number, rx: number, ry: number, col: string) => {
        x.fillStyle = col;
        x.beginPath();
        x.ellipse(o + cx, cy, rx, ry, 0, 0, Math.PI * 2);
        x.fill();
      };
      poly([[30, 19], [w[0][0] + 5, w[0][1] + 3], [w[1][0] + 5, w[1][1] + 3], [w[2][0] + 3, w[2][1] + 1], [37, 20]], '#5e1512');
      x.strokeStyle = '#8f1f1f';
      x.lineCap = 'round';
      x.lineWidth = 5;
      x.beginPath();
      x.moveTo(o + 22, 25);
      x.quadraticCurveTo(o + 10, 33, o + 5, 25);
      x.stroke();
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(o + 6, 27);
      x.quadraticCurveTo(o + 2, 22, o + 4, 17);
      x.stroke();
      poly([[1, 16], [7, 13], [5, 20]], '#e0b040');
      x.fillStyle = '#7a1818';
      x.fillRect(o + 24, 27, 3, 7);
      x.fillRect(o + 34, 27, 3, 7);
      x.fillStyle = '#efe3c8';
      x.fillRect(o + 23, 33, 4, 1);
      x.fillRect(o + 33, 33, 4, 1);
      ell(30, 24, 12, 6, '#9a2420');
      ell(31, 27, 8, 2.6, '#e0b048');
      for (let s = 0; s < 5; s++) poly([[19 + s * 4, 20], [21 + s * 4, 15], [23 + s * 4, 20]], '#e0b040');
      x.strokeStyle = '#9a2420';
      x.lineWidth = 6;
      x.beginPath();
      x.moveTo(o + 38, 22);
      x.quadraticCurveTo(o + 44, 20, o + 48, 14);
      x.stroke();
      ell(51, 13, 6, 4.5, '#a8282a');
      x.fillStyle = '#a8282a';
      x.fillRect(o + 53, 11, 8, 4);
      x.fillStyle = '#6e1414';
      x.fillRect(o + 53, 15, 7, 2);
      poly([[47, 10], [42, 3], [50, 9]], '#efe3c8');
      poly([[50, 9], [48, 2], [53, 9]], '#efe3c8');
      x.fillStyle = '#ffe040';
      x.fillRect(o + 52, 11, 2, 1);
      x.fillStyle = '#1a0606';
      x.fillRect(o + 60, 12, 1, 1);
      poly([[30, 19], ...w, [38, 20]], '#c0392b');
      x.strokeStyle = '#5a0f0f';
      x.lineWidth = 1;
      w.forEach(([a, b]) => {
        x.beginPath();
        x.moveTo(o + 33, 19);
        x.lineTo(o + a, b);
        x.stroke();
      });
    }
    pixelize(x, 256, 40, '#1a0606');
    this.tex = ctex(c, { rep: false, mip: false });
    this.tex.repeat.set(0.25, 1);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 5.625), this.mat);
    this.mesh.castShadow = true;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  public enter(): void {
    this.active = true;
    this.phase = 'enter';
    this.theta = Math.random() * 6.28;
    this.radius = 70;
    this.y = 24;
    this.t = 0;
    this.breathCD = 2.6;
    this.breathing = 0;
    this.roarCD = 0.6;
  }

  public leave(): void {
    if (this.active) this.phase = 'leave';
  }

  public update(
    dt: number,
    opts: {
      camYaw: number;
      camRight: THREE.Vector3;
      grid: WorldGrid;
      villagers: Villager[];
      particles: ParticleSystem;
      audio: AudioEngine;
    }
  ): void {
    if (!this.active) {
      this.mesh.visible = false;
      return;
    }
    const { camYaw, camRight, grid, villagers, particles, audio } = opts;
    this.mesh.visible = true;
    this.t += dt;
    const prev = this.pos.clone();
    if (this.phase === 'enter') {
      this.radius = lerp(this.radius, 13, 1 - Math.exp(-dt * 0.9));
      this.y = lerp(this.y, 9, 1 - Math.exp(-dt * 1));
      this.theta += dt * 0.45;
      if (this.radius < 14.5) this.phase = 'circle';
    } else if (this.phase === 'circle') {
      this.theta += dt * 0.36;
      this.radius = 13 + Math.sin(this.t * 0.5) * 2.2;
      this.y = 8.6 + Math.sin(this.t * 0.9) * 1.4;
    } else {
      this.radius += dt * 22;
      this.y += dt * 5;
      this.theta += dt * 0.3;
      if (this.radius > 95) {
        this.active = false;
        this.phase = 'off';
      }
    }
    this.pos.set(
      PCW.x + Math.cos(this.theta) * this.radius,
      this.y + Math.sin(this.t * 5.5) * 0.25,
      PCW.z + Math.sin(this.theta) * this.radius * 0.85
    );
    const vel = this.pos.clone().sub(prev);
    if (this.breathing <= 0) {
      const s = vel.x * camRight.x + vel.z * camRight.z;
      if (Math.abs(s) > 0.002) this.face = Math.sign(s);
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = camYaw;
    this.mesh.scale.x = this.face;
    this.tex.offset.x = (Math.floor(this.t * 7) % 4) * 0.25;

    if (this.phase === 'circle' || this.phase === 'enter') {
      if ((this.roarCD -= dt) <= 0) {
        this.roarCD = R(8, 11);
        audio.roar();
        world.shake = Math.max(world.shake, 0.7);
      }
      if (this.phase === 'circle' && (this.breathCD -= dt) <= 0 && this.breathing <= 0) {
        this.breathCD = R(3, 4.5);
        this.breathing = 1.3;
        this.ignited = false;
        const guards = villagers.filter((v) => v.role === 'Guard' && !v.hidden);
        const base =
          Math.random() < 0.45 && guards.length
            ? ((g) => new V3(g.x, 0, g.z))(pick(guards))
            : new V3(PCW.x + R(-7, 7), 0, PCW.z + R(-7, 7));
        this.target.set(base.x + R(-1.5, 1.5), 0, base.z + R(-1.5, 1.5));
        this.target.y = grid.groundY(this.target.x, this.target.z);
        audio.whoosh();
      }
    }
    if (this.breathing > 0) {
      this.breathing -= dt;
      const s = (this.target.x - this.pos.x) * camRight.x + (this.target.z - this.pos.z) * camRight.z;
      this.face = s >= 0 ? 1 : -1;
      this.mesh.scale.x = this.face;
      const mouth = this.pos.clone().addScaledVector(camRight, this.face * 3.3).add(new V3(0, 0.9, 0));
      const dir = this.target.clone().sub(mouth);
      const dist = dir.length();
      dir.normalize();
      for (let k = 0; k < 7; k++) {
        const sp = R(14, 19);
        particles.fxAdd.spawn(
          mouth.x,
          mouth.y,
          mouth.z,
          dir.x * sp + R(-1.2, 1.2),
          dir.y * sp + R(-1.2, 1.2),
          dir.z * sp + R(-1.2, 1.2),
          3,
          R(1, 1.8),
          0.25,
          R(2.2, 3.8),
          (dist / sp) * R(0.9, 1.1),
          -1,
          0.2,
          1.4
        );
      }
      this.flash = 1;
      if (!this.ignited && this.breathing < 0.75) {
        this.ignited = true;
        this.igniteAt(this.target.x, this.target.z, grid, villagers, particles, audio);
      }
    }
    this.flash *= Math.exp(-dt * 4);
  }

  private igniteAt(
    x: number,
    z: number,
    grid: WorldGrid,
    villagers: Villager[],
    particles: ParticleSystem,
    audio: AudioEngine
  ): void {
    const y = grid.groundY(x, z);
    particles.fires.push({ x, y, z, t: 5 });
    world.shake = Math.max(world.shake, 0.35);
    for (let k = 0; k < 60; k++) {
      particles.fxAdd.spawn(x, y + 0.2, z, R(-4, 4), R(2, 7), R(-4, 4), 3, R(1, 1.6), 0.3, R(0.4, 0.8), R(0.6, 1.4), 7, 0.6);
    }
    villagers.forEach((v) => {
      if (!v.hidden && Math.hypot(v.x - x, v.z - z) < 3.5) {
        v.hp = Math.max(1, v.hp - RI(6, 16));
        v.activity = '🔥 Singed by dragonfire — holding the line!';
        v.xp += 15;
      }
    });
    audio.crackle();
  }
}
