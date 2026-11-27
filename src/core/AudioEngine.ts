import { clamp, smooth } from '../utils/math';
import { world } from './WorldState';

const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export type MusicMode = 'peace' | 'night' | 'festival' | 'battle';

export const MODES: Record<
  MusicMode,
  { tempo: number; label: string; prog: number[][]; scale: number[] }
> = {
  peace: {
    tempo: 96,
    label: '🪕 Peaceful Lute & Flute',
    prog: [
      [62, 66, 69],
      [57, 61, 64],
      [59, 62, 66],
      [55, 59, 62],
    ],
    scale: [62, 64, 66, 69, 71, 74, 76, 78, 81, 83],
  },
  night: {
    tempo: 66,
    label: '🌙 Lantern Nocturne',
    prog: [
      [62, 66, 69],
      [59, 62, 66],
      [55, 59, 62],
      [57, 61, 64],
    ],
    scale: [62, 64, 66, 69, 71, 74, 76, 78, 81],
  },
  festival: {
    tempo: 138,
    label: '🎉 Harvest Jig',
    prog: [
      [67, 71, 74],
      [60, 64, 67],
      [62, 66, 69],
      [67, 71, 74],
      [64, 67, 71],
      [60, 64, 67],
      [62, 66, 69],
      [62, 66, 69],
    ],
    scale: [67, 69, 71, 74, 76, 79, 81, 83, 86],
  },
  battle: {
    tempo: 152,
    label: '🥁 Dragonfire War Drums',
    prog: [
      [62, 65, 69],
      [58, 62, 65],
      [60, 64, 67],
      [57, 61, 64],
    ],
    scale: [62, 64, 65, 67, 69, 70, 72, 74, 76, 77],
  },
};

export class AudioEngine {
  public ctx: AudioContext | null = null;
  public on = true;
  public vol = 0.7;
  public mode: MusicMode = 'peace';
  public want: MusicMode = 'peace';
  private step = 0;
  private nextT = 0;
  private mi = 4;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private rev!: ConvolverNode;
  private noise!: AudioBuffer;
  private rainG!: GainNode;
  private windG!: GainNode;
  private getCamDist: () => { x: number; z: number; dist: number };

  constructor(getCamDist: () => { x: number; z: number; dist: number }) {
    this.getCamDist = getCamDist;
  }

  public init(): void {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.gain.value = this.on ? this.vol : 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    this.master.connect(comp);
    comp.connect(c.destination);
    this.music = c.createGain();
    this.music.gain.value = 0.55;
    this.music.connect(this.master);
    this.sfx = c.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.amb = c.createGain();
    this.amb.gain.value = 0.7;
    this.amb.connect(this.master);
    this.rev = c.createConvolver();
    this.rev.buffer = this.impulse(2.8);
    const wet = c.createGain();
    wet.gain.value = 0.32;
    this.rev.connect(wet);
    wet.connect(this.master);
    this.noise = (() => {
      const n = c.sampleRate * 2;
      const b = c.createBuffer(1, n, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    const loop = (type: BiquadFilterType, f: number, q: number) => {
      const s = c.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      const fl = c.createBiquadFilter();
      fl.type = type;
      fl.frequency.value = f;
      fl.Q.value = q;
      const g = c.createGain();
      g.gain.value = 0;
      s.connect(fl);
      fl.connect(g);
      g.connect(this.amb);
      s.start();
      return g;
    };
    this.rainG = loop('bandpass', 1400, 0.4);
    this.windG = loop('lowpass', 380, 0.7);
    this.nextT = c.currentTime + 0.1;
    setInterval(() => this.tick(), 25);
    const btn = document.getElementById('musicBtn');
    if (btn) btn.textContent = this.on ? '🔊 Music On' : '🔇 Muted';
  }

  public resume(): void {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  public setOn(on: boolean): void {
    this.on = on;
    if (this.ctx) this.master.gain.setTargetAtTime(on ? this.vol : 0, this.ctx.currentTime, 0.08);
    const btn = document.getElementById('musicBtn');
    if (btn) btn.textContent = on ? '🔊 Music On' : '🔇 Muted';
  }

  public setVol(v: number): void {
    this.vol = v;
    if (this.ctx && this.on) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  private impulse(sec: number): AudioBuffer {
    const c = this.ctx!;
    const n = (c.sampleRate * sec) | 0;
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
    }
    return b;
  }

  private out(node: AudioNode, bus: AudioNode, rev = 0.25): void {
    node.connect(bus);
    if (rev && this.ctx) {
      const s = this.ctx.createGain();
      s.gain.value = rev;
      node.connect(s);
      s.connect(this.rev);
    }
  }

  private env(g: GainNode, t: number, a: number, peak: number, dur: number): void {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  }

  private osc(type: OscillatorType, f: number, t: number, end: number): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(end);
    return o;
  }

  private nz(t: number, dur: number): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.start(t, Math.random() * 1.5, dur);
    return s;
  }

  private filt(type: BiquadFilterType, f: number, q = 1): BiquadFilterNode {
    const b = this.ctx!.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }

  private pluck(f: number, t: number, dur: number, vol: number, soft = false): void {
    const c = this.ctx!;
    const o = this.osc('triangle', f, t, t + dur + 0.05);
    const o2 = this.osc('sawtooth', f * 1.003, t, t + dur + 0.05);
    const g2 = c.createGain();
    g2.gain.value = soft ? 0.12 : 0.32;
    const fl = this.filt('lowpass', 1, 2);
    fl.frequency.setValueAtTime(Math.min(9000, f * (soft ? 5 : 9)), t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(180, f * 1.4), t + dur * 0.55);
    const g = c.createGain();
    this.env(g, t, 0.004, vol, dur);
    o.connect(fl);
    o2.connect(g2);
    g2.connect(fl);
    fl.connect(g);
    this.out(g, this.music, soft ? 0.45 : 0.22);
  }

  private strum(ch: number[], t: number, vol: number): void {
    ch.forEach((n, i) => this.pluck(mtof(n), t + i * 0.018, 0.35, vol));
    this.pluck(mtof(ch[0] + 12), t + 0.055, 0.3, vol * 0.8);
  }

  private flute(f: number, t: number, dur: number, vol: number): void {
    const c = this.ctx!;
    const end = t + dur + 0.2;
    const o = this.osc('sine', f, t, end);
    const o2 = this.osc('triangle', f * 2, t, end);
    const g2 = c.createGain();
    g2.gain.value = 0.06;
    const lfo = this.osc('sine', 5.4, t, end);
    const lg = c.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.009, t + 0.25);
    lfo.connect(lg);
    lg.connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.06);
    g.gain.setValueAtTime(vol * 0.85, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0008, end);
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    const b = this.nz(t, 0.12);
    const bf = this.filt('bandpass', f * 2, 1.5);
    const bg = c.createGain();
    bg.gain.setValueAtTime(vol * 0.35, t);
    bg.gain.exponentialRampToValueAtTime(0.0008, t + 0.12);
    b.connect(bf);
    bf.connect(bg);
    bg.connect(g);
    this.out(g, this.music, 0.35);
  }

  private bass(f: number, t: number, dur: number, vol: number): void {
    const g = this.ctx!.createGain();
    this.env(g, t, 0.01, vol, dur);
    this.osc('triangle', f, t, t + dur + 0.05).connect(g);
    this.out(g, this.music, 0.08);
  }

  private pad(fs: number[], t: number, dur: number, vol: number): void {
    const fl = this.filt('lowpass', 900, 0.5);
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    fs.forEach((f) =>
      [-7, 7].forEach((cents) => {
        const o = this.osc('sawtooth', f, t, t + dur + 0.7);
        o.detune.value = cents;
        o.connect(fl);
      })
    );
    fl.connect(g);
    this.out(g, this.music, 0.5);
  }

  private brass(f: number, t: number, dur: number, vol: number): void {
    const fl = this.filt('lowpass', 400, 3);
    const g = this.ctx!.createGain();
    fl.frequency.setValueAtTime(350, t);
    fl.frequency.linearRampToValueAtTime(2200, t + 0.07);
    fl.frequency.exponentialRampToValueAtTime(800, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.04);
    g.gain.setValueAtTime(vol * 0.8, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.12);
    [0, 6].forEach((d) => {
      const o = this.osc('sawtooth', f, t, t + dur + 0.15);
      o.detune.value = d;
      o.connect(fl);
    });
    fl.connect(g);
    this.out(g, this.music, 0.2);
  }

  private kick(t: number, vol: number): void {
    const g = this.ctx!.createGain();
    const o = this.osc('sine', 150, t, t + 0.4);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
    this.env(g, t, 0.002, vol, 0.32);
    o.connect(g);
    this.out(g, this.music, 0);
  }

  private taiko(t: number, vol: number): void {
    const g = this.ctx!.createGain();
    const o = this.osc('sine', 95, t, t + 0.7);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.3);
    this.env(g, t, 0.003, vol, 0.65);
    o.connect(g);
    const n = this.nz(t, 0.2);
    const nf = this.filt('lowpass', 500);
    const ng = this.ctx!.createGain();
    this.env(ng, t, 0.002, vol * 0.5, 0.18);
    n.connect(nf);
    nf.connect(ng);
    ng.connect(g);
    this.out(g, this.music, 0.15);
  }

  private snare(t: number, vol: number): void {
    const n = this.nz(t, 0.2);
    const f = this.filt('bandpass', 1900, 0.8);
    const g = this.ctx!.createGain();
    this.env(g, t, 0.002, vol, 0.16);
    n.connect(f);
    f.connect(g);
    const o = this.osc('triangle', 190, t, t + 0.1);
    const og = this.ctx!.createGain();
    this.env(og, t, 0.002, vol * 0.5, 0.08);
    o.connect(og);
    og.connect(g);
    this.out(g, this.music, 0.12);
  }

  private tamb(t: number, vol: number): void {
    const n = this.nz(t, 0.08);
    const f = this.filt('highpass', 7000);
    const g = this.ctx!.createGain();
    this.env(g, t, 0.001, vol, 0.07);
    n.connect(f);
    f.connect(g);
    this.out(g, this.music, 0.1);
  }

  private melody(scale: number[], ch: number[], strong: boolean): number {
    let i = clamp(this.mi + [-2, -1, -1, 0, 1, 1, 2][(Math.random() * 7) | 0], 0, scale.length - 1);
    if (strong) {
      const pcs = ch.map((n) => n % 12);
      let best = i;
      let bd = 99;
      scale.forEach((n, k) => {
        if (pcs.includes(n % 12) && Math.abs(k - i) < bd) {
          bd = Math.abs(k - i);
          best = k;
        }
      });
      i = best;
    }
    this.mi = i;
    return scale[i];
  }

  private tick(): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    if (this.nextT < c.currentTime - 0.2) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.14) {
      this.playStep(this.step, this.nextT);
      this.nextT += 60 / MODES[this.mode].tempo / 4;
      this.step++;
    }
    if (!world.raid && world.dayness > 0.6 && world.weather < 0.4 && Math.random() < 0.006) this.chirp();
    if (world.night > 0.6 && world.weather < 0.5 && Math.random() < 0.035) this.cricket();
  }

  private playStep(s: number, t: number): void {
    const st = s % 16;
    const bar = (s / 16) | 0;
    if (st === 0 && this.want !== this.mode) {
      this.mode = this.want;
      const np = document.getElementById('nowPlaying');
      if (np) np.textContent = `♪ Now playing: ${MODES[this.mode].label}`;
      if (this.mode === 'battle') this.warHorn(t);
    }
    const M = MODES[this.mode];
    const ch = M.prog[bar % M.prog.length];
    const b = 60 / M.tempo;
    const s16 = b / 4;
    switch (this.mode) {
      case 'peace':
        if (st % 2 === 0) {
          const pat = [0, 1, 2, 1, 0, 2, 1, 2];
          this.pluck(mtof(ch[pat[(st >> 1) % 8]] + (st % 8 === 4 ? 12 : 0)), t, b * 1.4, 0.07);
        }
        if (st === 0 || st === 10) this.bass(mtof(ch[0] - 24), t, b * 2.5, 0.16);
        if (st === 0) this.pad(ch.map((n) => mtof(n - 12)), t, b * 4, 0.018);
        if ((st % 4 === 0 && Math.random() < 0.7) || (st % 4 === 2 && Math.random() < 0.22)) {
          this.flute(mtof(this.melody(M.scale, ch, st === 0)), t, s16 * (st % 4 === 0 ? 3 : 1.6), 0.055);
        }
        break;
      case 'night':
        if (st % 2 === 0 && Math.random() < 0.6) {
          this.pluck(mtof(ch[(Math.random() * 3) | 0] + (Math.random() < 0.5 ? 12 : 0)), t, b * 2.5, 0.045, true);
        }
        if (st === 0) {
          this.bass(mtof(ch[0] - 24), t, b * 4, 0.11);
          this.pad(ch.map((n) => mtof(n - 12)), t, b * 4.2, 0.026);
        }
        if (st % 8 === 0 && Math.random() < 0.55) {
          this.flute(mtof(this.melody(M.scale, ch, st === 0)), t, b * 1.8, 0.04);
        }
        break;
      case 'festival':
        if (st % 4 === 2) this.strum(ch, t, 0.05);
        if (st % 4 === 0) this.bass(mtof((st % 8 === 0 ? ch[0] : ch[2]) - 24), t, b * 0.9, 0.17);
        if (st === 0 || st === 8) this.kick(t, 0.45);
        if (st % 2 === 1) this.tamb(t, st % 4 === 3 ? 0.11 : 0.05);
        if (st % 2 === 0 && Math.random() < 0.85) {
          this.flute(mtof(this.melody(M.scale, ch, st % 8 === 0)), t, s16 * 1.8, 0.05);
        }
        break;
      case 'battle':
        if ([0, 3, 6, 8, 10, 11, 13].includes(st)) this.taiko(t, st === 0 || st === 8 ? 0.9 : 0.55);
        if (st === 4 || st === 12) this.snare(t, 0.32);
        if (st >= 14 && bar % 2 === 1) {
          this.snare(t + s16 / 2, 0.2);
          this.snare(t, 0.22);
        }
        if (st % 2 === 0) this.brass(mtof(ch[0] - 24 + (st % 4 === 2 ? 7 : 0)), t, s16 * 1.5, 0.06);
        if (st === 0) {
          this.brass(mtof(ch[0] - 12), t, b * 3.6, 0.045);
          this.brass(mtof(ch[2] - 12), t, b * 3.6, 0.035);
        }
        if (st % 4 === 0 && Math.random() < 0.5) {
          this.brass(mtof(this.melody(M.scale, ch, st === 0) - 12), t, b * 0.9, 0.045);
        }
        break;
    }
  }

  private warHorn(t: number): void {
    this.brass(mtof(50), t, 1.6, 0.09);
    this.brass(mtof(57), t + 0.02, 1.6, 0.07);
  }

  public bell(n = 1, alarm = false): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    for (let k = 0; k < n; k++) {
      const t = t0 + k * (alarm ? 0.42 : 0.9);
      const f = alarm ? 330 : 262;
      const g = this.ctx.createGain();
      g.connect(this.sfx);
      const s = this.ctx.createGain();
      s.gain.value = 0.5;
      g.connect(s);
      s.connect(this.rev);
      [
        [0.5, 0.5, 3],
        [1, 0.4, 2.6],
        [1.19, 0.25, 2],
        [1.56, 0.2, 1.6],
        [2, 0.18, 1.3],
        [2.51, 0.1, 1],
        [3.01, 0.08, 0.8],
      ].forEach(([r, v, d]) => {
        const gg = this.ctx!.createGain();
        this.env(gg, t, 0.003, v * 0.16, d);
        this.osc('sine', f * r, t, t + d + 0.1).connect(gg);
        gg.connect(g);
      });
    }
  }

  public thunder(delay = 0.3): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const c = this.ctx;
    const n = this.nz(t, 4);
    const f = this.filt('lowpass', 320, 0.7);
    const g = c.createGain();
    f.frequency.setValueAtTime(420, t);
    f.frequency.exponentialRampToValueAtTime(70, t + 3.5);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1.1, t + 0.05);
    g.gain.setValueAtTime(0.8, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, t + 4);
    n.connect(f);
    f.connect(g);
    this.out(g, this.sfx, 0.3);
    const cr = this.nz(t, 0.25);
    const cf = this.filt('highpass', 1500);
    const cg = c.createGain();
    this.env(cg, t, 0.002, 0.5, 0.25);
    cr.connect(cf);
    cf.connect(cg);
    cg.connect(this.sfx);
  }

  public roar(): void {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const end = t + 2;
    const ws = c.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 128 - 1;
      curve[i] = Math.tanh(x * 4);
    }
    ws.curve = curve;
    const bp = this.filt('bandpass', 650, 0.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.18);
    g.gain.setValueAtTime(0.5, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.001, end);
    [
      [170, 62],
      [255, 90],
      [118, 44],
    ].forEach(([a, b]) => {
      const o = this.osc('sawtooth', a, t, end);
      o.frequency.exponentialRampToValueAtTime(b, t + 1.8);
      o.connect(ws);
    });
    const n = this.nz(t, 2);
    const nf = this.filt('bandpass', 420, 0.8);
    n.connect(nf);
    nf.connect(ws);
    ws.connect(bp);
    bp.connect(g);
    this.out(g, this.sfx, 0.35);
  }

  public whoosh(): void {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const n = this.nz(t, 1.4);
    const f = this.filt('bandpass', 300, 0.9);
    const g = c.createGain();
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
    f.frequency.exponentialRampToValueAtTime(500, t + 1.3);
    this.env(g, t, 0.08, 0.5, 1.4);
    n.connect(f);
    f.connect(g);
    this.out(g, this.sfx, 0.2);
  }

  public crackle(): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    for (let k = 0; k < 26; k++) {
      const t = t0 + Math.random() * 2.5;
      const n = this.nz(t, 0.03);
      const f = this.filt('highpass', 1800);
      const g = this.ctx.createGain();
      this.env(g, t, 0.001, Math.random() * 0.25, 0.03);
      n.connect(f);
      f.connect(g);
      g.connect(this.sfx);
    }
  }

  public launch(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.nz(t, 0.7);
    const f = this.filt('bandpass', 800, 2);
    const g = this.ctx.createGain();
    f.frequency.exponentialRampToValueAtTime(3500, t + 0.6);
    this.env(g, t, 0.05, 0.06, 0.7);
    n.connect(f);
    f.connect(g);
    g.connect(this.sfx);
  }

  public pop(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.nz(t, 0.5);
    const f = this.filt('lowpass', 900);
    const g = this.ctx.createGain();
    this.env(g, t, 0.002, 0.5, 0.45);
    n.connect(f);
    f.connect(g);
    this.out(g, this.sfx, 0.4);
    for (let k = 0; k < 14; k++) {
      const tt = t + 0.1 + Math.random() * 0.9;
      const c = this.nz(tt, 0.02);
      const cf = this.filt('highpass', 3000);
      const cg = this.ctx.createGain();
      this.env(cg, tt, 0.001, 0.08, 0.02);
      c.connect(cf);
      cf.connect(cg);
      cg.connect(this.sfx);
    }
  }

  public clang(x: number, z: number): void {
    if (!this.ctx) return;
    const cam = this.getCamDist();
    const d = Math.hypot(x - cam.x, z - cam.z);
    const v = 0.07 * clamp(1 - d / 30, 0, 1) * clamp(40 / cam.dist, 0.3, 1.4);
    if (v < 0.005) return;
    const t = this.ctx.currentTime;
    [1200, 1730, 2470, 3310].forEach((f, i) => {
      const g = this.ctx!.createGain();
      this.env(g, t, 0.001, v / (i + 1), 0.3);
      this.osc('sine', f, t, t + 0.35).connect(g);
      this.out(g, this.sfx, 0.3);
    });
  }

  private chirp(): void {
    const c = this.ctx!;
    const t0 = c.currentTime;
    const p = c.createStereoPanner();
    p.pan.value = Math.random() * 2 - 1;
    p.connect(this.amb);
    const base = 2400 + Math.random() * 1600;
    for (let k = 0, n = 2 + ((Math.random() * 3) | 0); k < n; k++) {
      const t = t0 + k * 0.11;
      const o = this.osc('sine', base, t, t + 0.09);
      const g = c.createGain();
      o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.07);
      this.env(g, t, 0.01, 0.035, 0.08);
      o.connect(g);
      g.connect(p);
    }
  }

  private cricket(): void {
    const c = this.ctx!;
    const t0 = c.currentTime;
    const p = c.createStereoPanner();
    p.pan.value = Math.random() * 2 - 1;
    p.connect(this.amb);
    for (let k = 0; k < 3; k++) {
      const t = t0 + k * 0.045;
      const g = c.createGain();
      this.env(g, t, 0.004, 0.012, 0.035);
      this.osc('sine', 4400 + Math.random() * 300, t, t + 0.04).connect(g);
      g.connect(p);
    }
  }

  public blip(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    this.env(g, t, 0.002, 0.06, 0.12);
    const o = this.osc('square', 880, t, t + 0.13);
    o.frequency.setValueAtTime(1320, t + 0.05);
    o.connect(g);
    g.connect(this.sfx);
  }

  public bowShot(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.osc('triangle', 260, t, t + 0.16);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.15);
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, 0.08, 0.16);
    o.connect(g);
    g.connect(this.sfx);

    const n = this.nz(t, 0.12);
    const f = this.filt('bandpass', 1800, 1.5);
    const ng = this.ctx.createGain();
    this.env(ng, t, 0.005, 0.05, 0.12);
    n.connect(f);
    f.connect(ng);
    ng.connect(this.sfx);
  }

  public arrowHit(x: number, z: number): void {
    if (!this.ctx) return;
    const cam = this.getCamDist();
    const d = Math.hypot(x - cam.x, z - cam.z);
    const v = 0.12 * clamp(1 - d / 35, 0.25, 1) * clamp(40 / cam.dist, 0.4, 1.4);
    const t = this.ctx.currentTime;
    const o = this.osc('sine', 180, t, t + 0.14);
    o.frequency.exponentialRampToValueAtTime(65, t + 0.13);
    const g = this.ctx.createGain();
    this.env(g, t, 0.002, v, 0.14);
    o.connect(g);
    g.connect(this.sfx);
  }

  public setWeather(w: number, night: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rainG.gain.setTargetAtTime(smooth(0.35, 0.8, w) * 0.55, t, 0.3);
    this.windG.gain.setTargetAtTime(smooth(0.2, 1, w) * 0.35, t, 0.4);
    this.want = world.raid ? 'battle' : world.festival ? 'festival' : night > 0.6 ? 'night' : 'peace';
  }
}
