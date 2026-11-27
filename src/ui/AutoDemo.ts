import { clamp, lerp, V3 } from '../utils/math';
import { fmtTime, overlay, phaseName, weatherName, world } from '../core/WorldState';
import { PCW, TH } from '../world/WorldGrid';
import type { Engine } from '../core/Engine';
import type { AudioEngine } from '../core/AudioEngine';
import type { Environment } from '../core/Environment';
import type { WorldBuildings } from '../world/Buildings';
import type { Dragon } from '../entities/Dragon';
import type { HeroController } from '../entities/HeroController';
import type { Villager } from '../entities/Villager';
import type { HUD } from './HUD';

const $ = (id: string) => document.getElementById(id)!;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class AutoDemo {
  public active = false;
  public done = false;
  private t0 = 0;
  private readonly total = 47;
  private readonly rec: {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D | null;
    mr: MediaRecorder | null;
    chunks: Blob[];
    active: boolean;
  } = {
    canvas: document.createElement('canvas'),
    ctx: null,
    mr: null,
    chunks: [],
    active: false,
  };

  private readonly engine: Engine;
  private readonly env: Environment;
  private readonly audio: AudioEngine;
  private readonly buildings: WorldBuildings;
  private readonly dragon: Dragon;
  private readonly villagers: Villager[];
  private readonly hero: HeroController;
  private readonly hud: HUD;

  constructor(opts: {
    engine: Engine;
    env: Environment;
    audio: AudioEngine;
    buildings: WorldBuildings;
    dragon: Dragon;
    villagers: Villager[];
    hero: HeroController;
    hud: HUD;
  }) {
    this.engine = opts.engine;
    this.env = opts.env;
    this.audio = opts.audio;
    this.buildings = opts.buildings;
    this.dragon = opts.dragon;
    this.villagers = opts.villagers;
    this.hero = opts.hero;
    this.hud = opts.hud;
  }

  private caption(title: string, sub = ''): void {
    const c = $('caption');
    c.querySelector('b')!.textContent = title;
    c.querySelector('span')!.textContent = sub;
    c.classList.add('show');
    overlay.caption = { title, sub, t0: performance.now() };
    $('recStep').textContent = title.replace(/^\W+/, '').slice(0, 26);
  }

  private press(el: HTMLElement): void {
    el.classList.remove('demo-press');
    void el.offsetWidth;
    el.classList.add('demo-press');
    el.click();
  }

  private slide(el: HTMLInputElement, from: number, to: number, dur: number): Promise<void> {
    return this.engine.tween(dur, (k) => {
      el.value = String(lerp(from, to, k));
      el.dispatchEvent(new Event('input'));
    });
  }

  private startRecording(): boolean {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      this.hud.toast('🎬 Recording not supported in this browser — running the demo only');
      return false;
    }
    const src = this.engine.renderer.domElement;
    const s = Math.min(1, 1920 / src.width, 1080 / src.height);
    this.rec.canvas.width = Math.round((src.width * s) / 2) * 2;
    this.rec.canvas.height = Math.round((src.height * s) / 2) * 2;
    this.rec.ctx = this.rec.canvas.getContext('2d');
    const stream = this.rec.canvas.captureStream(60);
    if (this.audio.dest) this.audio.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mime =
      ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) =>
        MediaRecorder.isTypeSupported(m)
      ) || '';
    try {
      this.rec.mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 14e6, audioBitsPerSecond: 160e3 });
    } catch {
      this.hud.toast('🎬 MediaRecorder failed to start — running the demo only');
      return false;
    }
    this.rec.chunks = [];
    this.rec.mr.ondataavailable = (e) => e.data.size && this.rec.chunks.push(e.data);
    this.rec.mr.start(250);
    this.rec.active = true;
    return true;
  }

  private stopRecording(): Promise<Blob | null> {
    return new Promise((res) => {
      if (!this.rec.mr || this.rec.mr.state === 'inactive') {
        this.rec.active = false;
        return res(null);
      }
      this.rec.mr.onstop = () => {
        this.rec.active = false;
        res(new Blob(this.rec.chunks, { type: this.rec.mr?.mimeType || 'video/webm' }));
      };
      this.rec.mr.stop();
    });
  }

  private download(blob: Blob): string {
    const a = document.createElement('a');
    const name = `emberbrook-hollow-demo-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.webm`;
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    return name;
  }

  private rr(
    x: CanvasRenderingContext2D,
    X: number,
    Y: number,
    w: number,
    h: number,
    r: number,
    fill?: string,
    stroke?: string
  ): void {
    x.beginPath();
    if (x.roundRect) x.roundRect(X, Y, w, h, r);
    else x.rect(X, Y, w, h);
    if (fill) {
      x.fillStyle = fill;
      x.fill();
    }
    if (stroke) {
      x.strokeStyle = stroke;
      x.lineWidth = 1.5;
      x.stroke();
    }
  }

  public compositeIfActive(): void {
    if (!this.rec.active || !this.rec.ctx) return;
    const c = this.rec.canvas;
    const x = this.rec.ctx;
    const W = c.width;
    const H = c.height;
    const u = H / 1080;
    const now = performance.now();
    const serif = '"Palatino Linotype",Palatino,Georgia,serif';

    x.drawImage(this.engine.renderer.domElement, 0, 0, W, H);
    x.save();
    x.textBaseline = 'alphabetic';
    x.shadowColor = 'rgba(0,0,0,.75)';
    x.shadowBlur = 14 * u;
    x.font = `600 ${42 * u}px ${serif}`;
    x.fillStyle = '#f3d27a';
    x.fillText('⚜ Emberbrook Hollow', 40 * u, 70 * u);
    x.font = `${19 * u}px ${serif}`;
    x.fillStyle = '#e8dcc0';
    x.fillText('HD-2D TILT-SHIFT DIORAMA  ·  DUNGEON MASTER SANDBOX', 44 * u, 100 * u);
    x.shadowBlur = 0;

    const st = `🕰 ${fmtTime(world.time)}  ·  ${phaseName(world.time)}  ·  ${weatherName(world.weather)}${world.festival ? '  ·  🎉 Festival' : ''}${world.raid ? '  ·  🐉 Raid' : ''}`;
    x.font = `${22 * u}px ${serif}`;
    const tw = x.measureText(st).width;
    this.rr(x, W - tw - 76 * u, 34 * u, tw + 40 * u, 46 * u, 23 * u, 'rgba(15,12,24,.72)', 'rgba(233,196,106,.6)');
    x.fillStyle = '#f4ead2';
    x.fillText(st, W - tw - 56 * u, 64 * u);

    const B = overlay.banner;
    if (B && now < B.until + 400) {
      const a = clamp((now - B.t0) / 400, 0, 1) * clamp((B.until + 400 - now) / 400, 0, 1);
      x.globalAlpha = a;
      x.textAlign = 'center';
      x.shadowColor = 'rgba(0,0,0,.9)';
      x.shadowBlur = 24 * u;
      x.font = `700 ${66 * u}px ${serif}`;
      x.fillStyle = B.style === 'red' ? '#ff6a4a' : '#ffd77a';
      x.fillText(B.title, W / 2, 200 * u);
      x.font = `${26 * u}px ${serif}`;
      x.fillStyle = '#f4ead2';
      x.fillText(B.sub, W / 2, 242 * u);
      x.shadowBlur = 0;
      x.globalAlpha = 1;
      x.textAlign = 'left';
    }

    const Cp = overlay.caption;
    if (Cp) {
      const a = clamp((now - Cp.t0) / 450, 0, 1);
      x.globalAlpha = a;
      const g = x.createLinearGradient(0, H - 230 * u, 0, H);
      g.addColorStop(0, 'rgba(8,6,14,0)');
      g.addColorStop(1, 'rgba(8,6,14,.82)');
      x.fillStyle = g;
      x.fillRect(0, H - 230 * u, W, 230 * u);
      x.textAlign = 'center';
      x.font = `600 ${40 * u}px ${serif}`;
      x.fillStyle = '#f3d27a';
      x.fillText(Cp.title, W / 2, H - 100 * u);
      x.font = `${24 * u}px ${serif}`;
      x.fillStyle = '#e8dcc0';
      x.fillText(Cp.sub, W / 2, H - 60 * u);
      x.textAlign = 'left';
      x.globalAlpha = 1;
    }

    const v = this.hud.selected;
    if (v) {
      const cw = 380 * u;
      const X = W - cw - 40 * u;
      const Y = 120 * u;
      const ch = 330 * u;
      this.rr(x, X, Y, cw, ch, 16 * u, 'rgba(18,14,28,.84)', 'rgba(233,196,106,.7)');
      x.imageSmoothingEnabled = false;
      x.drawImage(v.sheet, v.frame * 16, 0, 16, 24, X + 20 * u, Y + 22 * u, 64 * u, 96 * u);
      x.font = `600 ${27 * u}px ${serif}`;
      x.fillStyle = '#f3d27a';
      x.fillText(v.name, X + 100 * u, Y + 52 * u);
      x.font = `${17 * u}px ${serif}`;
      x.fillStyle = '#c9b78f';
      x.fillText(`${v.cls} · Level ${v.level}`, X + 100 * u, Y + 78 * u);
      const bar = (yy: number, f: number, c1: string, label: string) => {
        this.rr(x, X + 100 * u, yy, 256 * u, 16 * u, 8 * u, 'rgba(0,0,0,.5)');
        this.rr(x, X + 100 * u, yy, 256 * u * clamp(f, 0, 1), 16 * u, 8 * u, c1);
        x.font = `600 ${12 * u}px ui-monospace,Menlo,monospace`;
        x.fillStyle = '#fff';
        x.fillText(label, X + 110 * u, yy + 12.5 * u);
      };
      bar(Y + 92 * u, v.hp / v.hpMax, '#d9473a', `HP ${Math.ceil(v.hp)}/${v.hpMax}`);
      bar(Y + 114 * u, v.stamina / 100, '#3aa05a', `STAMINA ${Math.round(v.stamina)}`);
      x.font = `600 ${16 * u}px ui-monospace,Menlo,monospace`;
      x.fillStyle = '#f4ead2';
      Object.entries(v.stats).forEach(([k, n], i) => x.fillText(`${k} ${n}`, X + (22 + i * 88) * u, Y + 160 * u));
      x.font = `${17 * u}px ${serif}`;
      x.fillStyle = '#c9b78f';
      x.fillText('Mood', X + 22 * u, Y + 194 * u);
      x.fillText('Doing', X + 22 * u, Y + 220 * u);
      x.fillStyle = '#fff';
      x.fillText(v.mood, X + 90 * u, Y + 194 * u);
      x.fillText(v.activity.slice(0, 34), X + 90 * u, Y + 220 * u);
      x.fillStyle = '#e9c46a';
      x.fillText(`🪙 ${v.gold} gold`, X + 22 * u, Y + 248 * u);
      x.font = `${15 * u}px ${serif}`;
      x.fillStyle = '#f4ead2';
      v.inv.slice(0, 4).forEach((it, i) =>
        x.fillText(
          `${it.icon} ${it.name.slice(0, 18)}${it.qty > 1 ? ' ×' + it.qty : ''}`,
          X + (22 + (i % 2) * 180) * u,
          Y + (280 + (i >> 1) * 26) * u
        )
      );
    }
    x.restore();
  }

  public async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.t0 = performance.now();
    this.hero.clearMovement();
    this.hero.cancelInteraction();
    this.hero.path = [];
    this.hero.setBlueprintMode(false);
    this.hud.setChatOpen(false);
    $('chat').classList.add('hide');
    $('playerControls').classList.add('hide');
    this.audio.resume();
    this.audio.setOn(true);
    const demoBtn = $('demoBtn') as HTMLButtonElement;
    demoBtn.disabled = true;
    demoBtn.textContent = '🎬 Recording…';
    const hudEl = $('recHud');
    hudEl.classList.remove('hide', 'fade-out');

    this.hud.endRaid(true);
    this.hud.endFestival(true);
    this.dragon.active = false;
    this.hud.select(null);
    this.hud.setFollow(false, false);
    this.villagers.forEach((v) => {
      if (v.hidden) v.emerge();
      v.react();
    });
    world.flow = false;
    ($('flow') as HTMLInputElement).checked = false;
    world.weather = 0;
    world.time = 16.9;
    world.tilt = 1;
    ($('tilt') as HTMLInputElement).value = '1';
    world.focus = 0.5;
    ($('focus') as HTMLInputElement).value = '0.5';

    Object.assign(this.engine.goal, { yaw: -0.35, pitch: 1.05, dist: 100, fov: 30 });
    this.engine.goal.target.set(0, TH, 0);
    Object.assign(this.engine.cam, { yaw: this.engine.goal.yaw, pitch: this.engine.goal.pitch, dist: this.engine.goal.dist });
    this.engine.cam.target.copy(this.engine.goal.target);
    await wait(120);

    const recording = this.startRecording();
    const timer = window.setInterval(() => {
      const s = (performance.now() - this.t0) / 1000;
      $('recTime').textContent = `00:${String(Math.floor(s)).padStart(2, '0')}`;
      ($('recBar') as HTMLElement).style.width = `${Math.min(100, (s / this.total) * 100)}%`;
    }, 200);

    try {
      this.caption('Emberbrook Hollow', 'An HD-2D tilt-shift diorama — every pixel generated in code, zero image assets');
      await this.engine.camTo({ yaw: 0.7, pitch: 0.62, dist: 58, target: new V3(0.5, TH, 1.5) }, 6);

      this.caption('🌊 The River & Watermill', 'Animated water, spinning wheel, splashes, waterfalls off the diorama edge');
      await this.engine.camTo(
        { yaw: 1.25, pitch: 0.52, dist: 26, target: new V3(this.buildings.mill.splash.x + 1, TH, this.buildings.mill.splash.z + 1.5) },
        4.2
      );

      this.caption('⏳ Live Day / Night Scrubbing', 'Golden Hour → Midnight Lanterns: window glow, fireflies, light shafts');
      this.engine.camTo({ yaw: 0.35, pitch: 0.58, dist: 40, target: new V3(-1, TH, 2) }, 5);
      await this.slide($('time') as HTMLInputElement, 16.9, 23.9, 5);

      this.caption('⛈ Heavy Thunderstorm', 'Rain, wind, lightning bolts & rolling thunder — all procedural');
      this.engine.camTo({ yaw: -0.25, pitch: 0.62, dist: 46 }, 5);
      await this.slide($('weather') as HTMLInputElement, 0, 1, 2.2);
      this.env.strike(this.audio);
      await wait(1500);
      this.env.strike(this.audio);
      await wait(1300);

      this.caption('🌅 One Click: Golden Hour', 'Weather presets sweep the sky through a full time-lapse');
      this.press(document.querySelector('[data-preset="golden"]') as HTMLElement);
      await wait(2500);

      this.caption('🎉 Harvest Festival', 'Bonfire, bunting, fireworks, dancing villagers & a jig on lute and flute');
      this.press($('evFestival'));
      this.slide($('time') as HTMLInputElement, 17.8, 19.7, 1.4);
      await this.engine.camTo({ yaw: 0.45, pitch: 0.5, dist: 27, target: PCW.clone().add(new V3(0, 0.4, 0)) }, 3);
      await wait(3000);

      this.caption('🔍 Click Any Villager', 'Live RPG stats, mood, activity & inventory — updating in real time');
      const pickV = this.villagers.find((v) => v.role === 'Bard' && !v.hidden) || this.villagers.find((v) => !v.hidden) || null;
      this.hud.select(pickV);
      this.hud.setFollow(true, false);
      this.engine.camTo({ dist: 17, pitch: 0.42 }, 2.2);
      await wait(4200);

      this.hud.setFollow(false, false);
      this.caption('🐉 DRAGON RAID!', 'Guards draw their swords — villagers flee indoors — war drums take over');
      this.press($('evRaid'));
      this.engine.camTo({ yaw: 0.9, pitch: 0.6, dist: 46, target: PCW.clone() }, 3);
      await wait(3200);
      const guard = this.villagers.find((v) => v.role === 'Guard') || null;
      this.hud.select(guard);
      this.engine.camTo({ yaw: 1.5, dist: 40 }, 6);
      await wait(6400);

      this.caption('🕊 Dawn Breaks — Peace Restored', 'Your village. Your rules. The Dungeon Master Deck is yours.');
      this.press($('evPeace'));
      this.hud.select(null);
      {
        const t0 = world.time;
        const w0 = world.weather;
        const span = (((6.9 - t0) % 24) + 24) % 24;
        this.engine.tween(3.2, (k) => {
          world.time = (t0 + span * k) % 24;
          world.weather = lerp(w0, 0, k);
        });
      }
      await this.engine.camTo({ yaw: 0.55, pitch: 0.55, dist: 36, target: new V3(10.5, 2.6, -9) }, 4);
      await wait(500);
    } finally {
      clearInterval(timer);
      $('caption').classList.remove('show');
      overlay.caption = null;
      const blob = recording ? await this.stopRecording() : null;
      if (blob && blob.size) this.hud.toast(`🎞 Saved ${this.download(blob)}`, 4500);
      else if (recording) this.hud.toast('🎬 Recording produced no data');
      for (const el of [$('demoBtn'), hudEl]) {
        el.classList.add('fade-out');
        setTimeout(() => el.classList.add('hide'), 750);
      }
      this.active = false;
      this.done = true;
      $('chat').classList.remove('hide');
      $('playerControls').classList.remove('hide');
      this.hud.focusHero();
      this.engine.goal.dist = 23;
    }
  }
}
