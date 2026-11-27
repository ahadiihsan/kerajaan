import * as THREE from 'three';
import { pick, R, rand, RI } from '../utils/math';
import { PC, PCW, ti, tj, WorldGrid, wx, wz, type TileCoord } from '../world/WorldGrid';
import type { HouseRecord, WorldBuildings } from '../world/Buildings';
import type { Pool } from '../core/Particles';
import type { AudioEngine } from '../core/AudioEngine';
import { world } from '../core/WorldState';
import { characterSprite, makeLook, type CharacterLook, type CharacterRole } from './Sprites';

const FIRST = [
  'Aldric', 'Brenna', 'Cedric', 'Dagny', 'Elric', 'Fenna', 'Garrick', 'Hilda', 'Isolde', 'Jory',
  'Kael', 'Liora', 'Marek', 'Nell', 'Osric', 'Perrin', 'Quill', 'Rowena', 'Sten', 'Tamsin',
  'Ulric', 'Vesna', 'Wynn', 'Ysolde', 'Bram', 'Mira', 'Tobin', 'Gwen', 'Hob', 'Elsbeth',
];
const LAST = [
  'Ashdown', 'Brightwater', 'Thornfield', 'Mossbrook', 'Hollowell', 'Fernsby',
  'Oakhart', 'Wrenfield', 'Stormcrow', 'Applegate', 'Emberly', 'Fairweather',
];

type InvItemTuple = [string, string, number];
interface RoleTemplate {
  cls: string;
  hp: [number, number];
  st: [[number, number], [number, number], [number, number], [number, number]];
  lv: [number, number];
  gold: [number, number];
  inv: InvItemTuple[];
}

const ROLE: Record<Exclude<CharacterRole, 'Traveler'>, RoleTemplate> = {
  Guard: { cls: 'Town Guard', hp: [95, 130], st: [[14, 18], [11, 15], [7, 11], [8, 12]], lv: [6, 14], gold: [20, 60], inv: [['⚔️', 'Steel Longsword', 1], ['🛡️', 'Kite Shield', 1], ['🍞', 'Trail Rations', 3], ['🗝️', 'Gate Key', 1]] },
  Blacksmith: { cls: 'Master Blacksmith', hp: [85, 110], st: [[15, 19], [9, 12], [10, 13], [8, 11]], lv: [8, 15], gold: [60, 140], inv: [['🔨', 'Smithing Hammer', 1], ['⛓️', 'Iron Ingots', 6], ['🗡️', 'Blade (0% forged)', 1], ['🪨', 'Coal Lumps', 12]] },
  Merchant: { cls: 'Travelling Merchant', hp: [50, 70], st: [[8, 11], [10, 13], [13, 17], [15, 19]], lv: [4, 11], gold: [150, 400], inv: [['🍎', 'Crisp Apples', 12], ['🧵', 'Silk Bolt', 2], ['🧪', 'Healing Potion', 4], ['💎', 'Moonstone', 1]] },
  Farmer: { cls: 'Wheat Farmer', hp: [60, 85], st: [[12, 15], [10, 13], [8, 11], [9, 12]], lv: [2, 8], gold: [10, 40], inv: [['🌾', 'Wheat Sheaves', 8], ['🥕', 'Carrots', 6], ['🪣', 'Milk Pail', 1]] },
  Townsfolk: { cls: 'Townsfolk', hp: [45, 65], st: [[8, 12], [9, 13], [9, 13], [10, 14]], lv: [1, 6], gold: [5, 50], inv: [] },
  Bard: { cls: 'Wandering Bard', hp: [50, 65], st: [[8, 10], [13, 16], [12, 15], [16, 20]], lv: [5, 12], gold: [8, 30], inv: [['🪕', 'Old Lute', 1], ['📜', 'Song Sheets', 7], ['🍺', 'Mug of Ale', 1]] },
  Child: { cls: 'Village Child', hp: [28, 40], st: [[5, 8], [12, 16], [8, 12], [12, 16]], lv: [1, 2], gold: [0, 6], inv: [['🪀', 'Wooden Toy', 1], ['🍬', 'Honey Sweets', 3], ['🐸', 'Pet Frog', 1]] },
  Priest: { cls: 'Chapel Priest', hp: [55, 75], st: [[7, 10], [8, 11], [15, 19], [13, 17]], lv: [7, 13], gold: [20, 70], inv: [['📖', 'Holy Tome', 1], ['🕯️', 'Blessed Candles', 6], ['🔔', 'Hand Bell', 1]] },
};

const TOWN_ITEMS: InvItemTuple[] = [
  ['🧺', 'Wicker Basket', 1], ['🍞', 'Fresh Bread', 2], ['🧶', 'Wool Yarn', 3], ['🕯️', 'Candle', 2],
  ['🌼', 'Wildflowers', 5], ['📜', 'Love Letter', 1], ['🧀', 'Wheel of Cheese', 1], ['🪡', 'Sewing Kit', 1],
];

const POIS: Array<[TileCoord, string]> = [
  [[25, 21], '🪣 Fetching water at the well'],
  [[21, 27], '🛒 Browsing the market'],
  [[25, 23], '🛒 Haggling with a merchant'],
  [[31, 10], '🙏 Visiting the chapel'],
  [[6, 24], '🌊 Watching the river'],
  [[15, 8], '🌾 Taking grain to the mill'],
  [[22, 26], '💬 Gossiping in the plaza'],
  [[24, 24], '💬 Chatting by the fire pit'],
  [[2, 32], '🌾 Helping in the fields'],
  [[9, 25], '🎣 Fishing off the bank'],
];

const PATROL: TileCoord[] = [[17, 24], [27, 20], [27, 13], [10, 24], [3, 24], [24, 29], [30, 30], [20, 22]];
const RALLY: TileCoord[] = [[21, 23], [25, 23], [21, 27], [25, 27], [23, 22], [23, 28]];

export interface VillagerContext {
  scene: THREE.Scene;
  grid: WorldGrid;
  buildings: WorldBuildings;
  fxAdd: Pool;
  fxNorm: Pool;
  audio: AudioEngine;
  camRight: THREE.Vector3;
  getCamYaw: () => number;
  getDragonState: () => { active: boolean; pos: THREE.Vector3 };
  getVillagerCount: () => number;
}

export class Villager {
  public readonly id: number;
  public readonly role: Exclude<CharacterRole, 'Traveler'>;
  public readonly home: { door: TileCoord };
  public readonly cls: string;
  public readonly look: CharacterLook;
  public readonly sheet: HTMLCanvasElement;
  public readonly tex: THREE.CanvasTexture;
  public readonly mat: THREE.MeshBasicMaterial;
  public readonly mesh: THREE.Mesh;
  public readonly sc: number;
  public readonly name: string;
  public level: number;
  public hpMax: number;
  public hp: number;
  public stamina: number;
  public xp: number;
  public readonly stats: Record<string, number>;
  public gold: number;
  public readonly inv: Array<{ icon: string; name: string; qty: number }>;
  public readonly nightOwl: boolean;
  public readonly speed: number;
  public readonly ox: number;
  public readonly oz: number;
  public x: number;
  public z: number;
  public path: TileCoord[] = [];
  public state: 'idle' | 'walk' | 'dance' | 'guard' | 'perform' | 'work' = 'idle';
  public timer: number;
  public t: number;
  public walkT = 0;
  public frame = 0;
  public face = 1;
  public hidden = false;
  public hideReason = '';
  public hideT = 0;
  public activity = '🚶 Strolling about';
  public mood = 'Content';
  public run = false;
  public onArrive: (() => void) | null = null;
  public work: 'smith' | 'sell' | 'farm' | 'perform' | 'pray' | null = null;
  public danceA = 0;
  public forge = 0;
  public tick = 0;

  private readonly ctx: VillagerContext;

  constructor(id: number, role: Exclude<CharacterRole, 'Traveler'>, home: { door: TileCoord }, ctx: VillagerContext) {
    this.ctx = ctx;
    const D = ROLE[role];
    this.id = id;
    this.role = role;
    this.home = home;
    this.cls = D.cls;
    this.look = makeLook(role);
    const sprite = characterSprite(ctx.scene, this.look);
    this.sheet = sprite.sheet;
    this.tex = sprite.tex;
    this.mat = sprite.mat;
    this.mesh = sprite.mesh;
    this.mesh.userData.v = this;
    this.sc = role === 'Child' ? 0.74 : 1;
    this.name = `${pick(FIRST)} ${pick(LAST)}`;
    this.level = RI(...D.lv);
    this.hpMax = RI(...D.hp);
    this.hp = this.hpMax;
    this.stamina = RI(70, 100);
    this.xp = RI(0, this.level * 80);
    this.stats = Object.fromEntries(['STR', 'DEX', 'INT', 'CHA'].map((k, n) => [k, RI(...D.st[n])]));
    this.gold = RI(...D.gold);
    this.inv = (role === 'Townsfolk' ? [...TOWN_ITEMS].sort(() => rand() - 0.5).slice(0, 3) : D.inv).map(
      ([icon, name, qty]) => ({ icon, name, qty })
    );
    this.nightOwl = rand() < 0.3;
    this.speed = R(1.05, 1.45) * (role === 'Child' ? 1.25 : 1);
    this.ox = R(-0.22, 0.22);
    this.oz = R(-0.22, 0.22);
    const [si, sj] = ctx.grid.randomReach(9);
    this.x = wx(si) + this.ox;
    this.z = wz(sj) + this.oz;
    this.timer = R(0, 2);
    this.t = R(0, 9);
  }

  public tile(): TileCoord {
    return [ti(this.x), tj(this.z)];
  }

  public invAdd(name: string, d: number, icon = '📦'): void {
    const it = this.inv.find((i) => i.name === name);
    if (it) it.qty = Math.max(0, it.qty + d);
    else if (d > 0) this.inv.push({ icon, name, qty: d });
  }

  public goTo([gi, gj]: TileCoord, activity: string, run = false, onArrive: (() => void) | null = null): boolean {
    const [si, sj] = this.tile();
    const p = this.ctx.grid.findPath(si, sj, gi, gj);
    if (!p) return false;
    this.path = p;
    this.activity = activity;
    this.run = run;
    this.onArrive = onArrive;
    this.state = 'walk';
    if (!p.length) this.arrive();
    return true;
  }

  public arrive(): void {
    this.state = 'idle';
    this.timer = R(1.5, 4);
    const cb = this.onArrive;
    this.onArrive = null;
    if (cb) cb();
  }

  public hide(act: string, reason: string, dur = 999): void {
    this.hidden = true;
    this.activity = act;
    this.hideReason = reason;
    this.hideT = dur;
    this.state = 'idle';
    this.path = [];
    for (let k = 0; k < 10; k++) {
      this.ctx.fxNorm.spawn(
        this.x,
        this.ctx.grid.groundY(this.x, this.z) + 0.3,
        this.z,
        R(-1, 1),
        R(0.5, 1.5),
        R(-1, 1),
        0.75,
        0.68,
        0.55,
        R(0.6, 1),
        R(0.4, 0.8),
        1,
        2,
        1.5,
        0.6
      );
    }
  }

  public emerge(): void {
    const [i, j] = this.home.door;
    this.x = wx(i) + this.ox;
    this.z = wz(j) + this.oz;
    this.hidden = false;
    this.state = 'idle';
    this.timer = R(0.2, 1.2);
    this.activity = '🚪 Stepping outside';
    this.mood = world.raidEndedAt && world.T - world.raidEndedAt < 20 ? 'Relieved' : 'Refreshed';
  }

  public react(): void {
    this.path = [];
    this.onArrive = null;
    this.state = 'idle';
    this.timer = R(0.05, 0.9);
    this.work = null;
    if (this.hidden && this.hideReason === 'raid' && !world.raid) this.hideT = R(0.8, 4.5);
  }

  public decide(): void {
    const W = world;
    const { grid, buildings } = this.ctx;
    if (W.raid) {
      if (this.role === 'Guard') {
        const rp = RALLY[this.id % RALLY.length];
        this.mood = 'Valiant';
        this.goTo(rp, '🛡 Charging to defend the plaza!', true, () => {
          this.state = 'guard';
          this.activity = '⚔ Swords drawn — defending the village!';
        });
      } else {
        this.mood = 'Terrified';
        if (!this.goTo(this.home.door, '🏃 Fleeing indoors!', true, () => this.hide('🔒 Hiding indoors from the dragon', 'raid'))) {
          this.hide('🔒 Hiding indoors from the dragon', 'raid');
        }
      }
      return;
    }
    if (W.festival) {
      if (this.role === 'Bard') {
        this.goTo([20, 24], '🎵 Heading to the bonfire', false, () => {
          this.state = 'perform';
          this.activity = '🪕 Playing a harvest jig';
          this.mood = 'Inspired';
        });
        return;
      }
      const a = (this.id / this.ctx.getVillagerCount()) * Math.PI * 2;
      const t: TileCoord = [ti(PCW.x + Math.cos(a) * 2.6), tj(PCW.z + Math.sin(a) * 2.6)];
      if (
        !this.goTo(grid.walkable(...t) ? t : [PC[0] - 2, PC[1]], '🎉 Hurrying to the festival', false, () => {
          this.state = 'dance';
          this.danceA = Math.atan2(this.z - PCW.z, this.x - PCW.x);
          this.activity = '💃 Dancing around the bonfire';
          this.mood = 'Joyful';
        })
      ) {
        this.timer = 1;
      }
      return;
    }
    if (W.night > 0.72 && !this.nightOwl && this.role !== 'Guard') {
      this.mood = 'Sleepy';
      if (!this.goTo(this.home.door, '🥱 Heading home to sleep', false, () => this.hide('💤 Sleeping soundly', 'sleep'))) {
        this.hide('💤 Sleeping soundly', 'sleep');
      }
      return;
    }
    this.mood = W.weather > 0.6 ? 'Soggy' : W.night > 0.5 ? 'Dreamy' : pick(['Content', 'Cheerful', 'Busy', 'Curious']);
    const r = Math.random();
    const wander = () =>
      this.goTo(grid.randomReach(10), pick(['🚶 Strolling about', '🌤 Enjoying the air', '👀 People-watching']));
    switch (this.role) {
      case 'Guard':
        this.goTo(pick(PATROL), '👮 Patrolling the village', false, () => {
          this.activity = '🗡 Standing watch';
          this.timer = R(3, 6);
        });
        break;
      case 'Blacksmith':
        if (r < 0.7) {
          this.goTo(buildings.forge.spot, '🔥 Walking to the forge', false, () =>
            this.startWork('smith', '🔨 Hammering a blade at the anvil', R(9, 15))
          );
        } else wander();
        break;
      case 'Merchant': {
        const s = buildings.stalls[this.id % buildings.stalls.length];
        if (r < 0.75) {
          this.goTo(s.spot, '🧺 Returning to the stall', false, () => this.startWork('sell', '🪙 Selling wares', R(10, 16)));
        } else wander();
        break;
      }
      case 'Farmer':
        if (r < 0.7) {
          const f = pick<TileCoord>([[1, 30], [2, 33], [3, 36], [1, 38], [33, 35], [35, 37], [36, 34]]);
          this.goTo(f, '🌾 Heading to the fields', false, () => this.startWork('farm', '🌾 Harvesting wheat', R(8, 14)));
        } else wander();
        break;
      case 'Priest':
        if (r < 0.6) {
          this.goTo(buildings.chapel.door, '⛪ Walking to the chapel', false, () =>
            this.startWork('pray', '🙏 Leading evening vespers', R(8, 12))
          );
        } else wander();
        break;
      case 'Bard':
        if (r < 0.55) {
          this.goTo(grid.randomReach(4), '🎵 Looking for an audience', false, () =>
            this.startWork('perform', '🪕 Strumming for coins', R(6, 10))
          );
        } else wander();
        break;
      case 'Child':
        this.goTo(grid.randomReach(7), pick(['🏃 Playing tag', '🐸 Chasing frogs', '🪁 Running about']), Math.random() < 0.6);
        break;
      default: {
        if (r < 0.12) {
          this.goTo(this.home.door, '🏠 Heading home', false, () => this.hide('🏠 Resting at home', 'rest', R(6, 14)));
          break;
        }
        const [t, act] = pick(POIS);
        if (
          !this.goTo(t, act, false, () => {
            this.activity = act;
            this.timer = R(3, 7);
            if (act.includes('market') || act.includes('Haggling')) {
              this.gold = Math.max(0, this.gold - RI(1, 4));
              this.invAdd('Market Goods', 1, '🛍️');
            }
          })
        ) {
          wander();
        }
      }
    }
  }

  public startWork(kind: NonNullable<Villager['work']>, act: string, dur: number): void {
    this.state = 'work';
    this.work = kind;
    this.activity = act;
    this.timer = dur;
    this.t = 0;
  }

  public update(dt: number): void {
    if (this.hidden) {
      this.mesh.visible = false;
      this.hideT -= dt;
      this.stamina = Math.min(100, this.stamina + dt * 6);
      this.hp = Math.min(this.hpMax, this.hp + dt * 2);
      if (!world.raid && (this.hideReason === 'sleep' ? world.night < 0.55 || world.festival : this.hideT <= 0)) {
        this.emerge();
      }
      return;
    }
    this.mesh.visible = true;
    this.t += dt;
    this.tick += dt;
    let bob = 0;
    let frame = 0;
    const { camRight, grid, buildings, fxAdd, audio } = this.ctx;

    if (this.state === 'walk') {
      const [pi, pj] = this.path[0];
      const tx = wx(pi) + this.ox;
      const tz = wz(pj) + this.oz;
      const dx = tx - this.x;
      const dz = tz - this.z;
      const d = Math.hypot(dx, dz);
      const sp = this.speed * (this.run ? 2.2 : 1) * dt;
      if (d <= sp) {
        this.x = tx;
        this.z = tz;
        this.path.shift();
        if (!this.path.length) this.arrive();
      } else {
        this.x += (dx / d) * sp;
        this.z += (dz / d) * sp;
        const s = (dx * camRight.x + dz * camRight.z) / d;
        if (Math.abs(s) > 0.25) this.face = Math.sign(s);
      }
      this.walkT += dt * (this.run ? 13 : 8);
      frame = [1, 0, 2, 0][Math.floor(this.walkT) % 4];
      this.stamina = Math.max(0, this.stamina - dt * (this.run ? 5 : 0.6));
    } else if (this.state === 'dance') {
      this.danceA += dt * 0.5;
      const tx = PCW.x + Math.cos(this.danceA) * 2.6;
      const tz = PCW.z + Math.sin(this.danceA) * 2.6;
      const dx = tx - this.x;
      const dz = tz - this.z;
      const d = Math.hypot(dx, dz);
      const sp = Math.min(d, 3 * dt);
      if (d > 0.001) {
        this.x += (dx / d) * sp;
        this.z += (dz / d) * sp;
        const s = (dx * camRight.x + dz * camRight.z) / d;
        if (Math.abs(s) > 0.2) this.face = Math.sign(s);
      }
      bob = Math.abs(Math.sin(this.t * 6 + this.id)) * 0.28;
      frame = Math.floor(this.t * 3 + this.id) % 2 ? 3 : 1;
      if (Math.random() < dt * 0.3) this.xp += 5;
    } else if (this.state === 'guard') {
      const dragon = this.ctx.getDragonState();
      if (dragon.active) {
        const s = (dragon.pos.x - this.x) * camRight.x + (dragon.pos.z - this.z) * camRight.z;
        this.face = s >= 0 ? 1 : -1;
      }
      frame = Math.floor(this.t * 1.6 + this.id) % 3 ? 3 : 0;
      if (Math.random() < dt * 0.8) {
        fxAdd.spawn(this.x + this.face * 0.35, grid.groundY(this.x, this.z) + 1.55, this.z, 0, 0.5, 0, 2, 2, 2.2, 0.45, 0.25);
      }
    } else if (this.state === 'perform') {
      frame = Math.floor(this.t * 2.5) % 2 ? 3 : 0;
      bob = Math.abs(Math.sin(this.t * 5)) * 0.06;
      if (this.tick > 4) {
        this.tick = 0;
        this.gold += RI(1, 3);
        this.xp += 3;
      }
      if (!world.festival) {
        this.state = 'idle';
        this.timer = 0.5;
      }
    } else if (this.state === 'work') {
      this.timer -= dt;
      switch (this.work) {
        case 'smith': {
          const on = Math.floor(this.t * 2.6) % 2 === 1;
          if (on && this.frame !== 3) {
            for (let k = 0; k < 14; k++) {
              fxAdd.spawn(
                buildings.forge.anvil.x,
                buildings.forge.anvil.y,
                buildings.forge.anvil.z,
                R(-2, 2),
                R(1, 3.5),
                R(-2, 2),
                2.6,
                1.6,
                0.5,
                R(0.25, 0.5),
                R(0.25, 0.6),
                9,
                0.5
              );
            }
            audio.clang(this.x, this.z);
            this.forge = Math.min(100, this.forge + RI(2, 5));
            const b = this.inv.find((i) => i.icon === '🗡️');
            if (b) b.name = `Blade (${this.forge}% forged)`;
            if (this.forge >= 100) {
              this.forge = 0;
              this.invAdd('Steel Sword', 1, '⚔️');
              this.invAdd('Iron Ingots', -1);
              this.xp += 25;
            }
          }
          frame = on ? 3 : 0;
          break;
        }
        case 'sell':
          frame = Math.floor(this.t) % 4 === 0 ? 3 : 0;
          if (this.tick > 3) {
            this.tick = 0;
            this.gold += RI(1, 5);
            this.invAdd('Crisp Apples', -1);
            const a = this.inv.find((i) => i.name === 'Crisp Apples');
            if (a && a.qty === 0) a.qty = 12;
          }
          break;
        case 'farm':
          frame = Math.floor(this.t * 0.8) % 3 === 2 ? 3 : 0;
          if (this.tick > 2.2) {
            this.tick = 0;
            this.invAdd('Wheat Sheaves', 1);
            this.xp += 2;
          }
          break;
        case 'perform':
          frame = Math.floor(this.t * 2.5) % 2 ? 3 : 0;
          if (this.tick > 4) {
            this.tick = 0;
            this.gold += RI(1, 3);
          }
          break;
        case 'pray':
          frame = Math.floor(this.t * 0.5) % 4 === 3 ? 3 : 0;
          break;
      }
      this.stamina = Math.max(0, this.stamina - dt * 0.8);
      if (this.timer <= 0) {
        this.state = 'idle';
        this.timer = R(0.5, 2);
      }
    } else {
      this.timer -= dt;
      this.stamina = Math.min(100, this.stamina + dt * 4);
      if (this.timer <= 0) {
        this.timer = R(1, 2.5);
        this.decide();
      }
    }

    if (!world.raid) this.hp = Math.min(this.hpMax, this.hp + dt * 0.8);
    while (this.xp >= this.level * 100) {
      this.xp -= this.level * 100;
      this.level++;
      this.hpMax += 6;
      this.hp = this.hpMax;
    }
    this.frame = frame;
    this.tex.offset.x = frame * 0.25;
    const y = grid.groundY(this.x, this.z);
    this.mesh.position.set(this.x, y + bob, this.z);
    this.mesh.rotation.y = this.ctx.getCamYaw();
    this.mesh.scale.set(this.face * this.sc, this.sc, this.sc);
  }
}

const ROSTER: Array<[Exclude<CharacterRole, 'Traveler'>, number]> = [
  ['Guard', 4],
  ['Blacksmith', 1],
  ['Merchant', 2],
  ['Farmer', 3],
  ['Townsfolk', 8],
  ['Bard', 1],
  ['Child', 3],
  ['Priest', 1],
];

export function createVillagers(houses: HouseRecord[], chapelDoor: TileCoord, ctx: VillagerContext): Villager[] {
  const villagers: Villager[] = [];
  let id = 0;
  const homes = houses.slice(0, 8);
  for (const [role, n] of ROSTER) {
    for (let k = 0; k < n; k++) {
      const home =
        role === 'Farmer'
          ? houses[8]
          : role === 'Guard'
            ? houses[7]
            : role === 'Priest'
              ? { door: chapelDoor }
              : homes[id % homes.length];
      villagers.push(new Villager(id++, role, home, ctx));
    }
  }
  return villagers;
}
