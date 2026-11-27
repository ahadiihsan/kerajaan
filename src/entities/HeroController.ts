import { FISH } from '../core/Fishing';
import * as THREE from 'three';
import { clamp, lerp, R, V3 } from '../utils/math';
import { idx, inGrid, N, T, TH, ti, tj, WATER_Y, WorldGrid, wx, wz, type TileCoord } from '../world/WorldGrid';
import type { SharedMaterials, ProceduralTextures } from '../world/Textures';
import type { WorldBuildings } from '../world/Buildings';
import type { WorldVegetation } from '../world/Vegetation';
import { DEER_MEAT_YIELD, type WorldWildlife } from '../world/Wildlife';
import type { AudioEngine } from '../core/AudioEngine';
import type { Pool } from '../core/Particles';
import type { Villager } from './Villager';
import { characterSprite, DEFAULT_TRAVELER_PALETTE, type TravelerPalette } from './Sprites';
import { BOW_IDLE_FRAME, BOW_RAISE_FRAME, FISH_CAST_FRAME, FISH_HOLD_FRAME, TRAVELER_FRAME_COUNT } from './TravelerFrames';

export const STRIKES_TO_FELL = 3;
export const HOUSE_WOOD_COST = 6;
const BOW_DRAW_TIME = 0.24;
const BOW_RELEASE_END = 0.35;
const BOW_SHOT_TIME = 0.52;
const BOW_RANGE = 15;
const ARROW_SPEED = 20;
const ARROW_GRAVITY = 14;
const RIPPLE_TIME = 0.65;

type CardinalDirection = 'up' | 'left' | 'down' | 'right';
export type MoveDirection = CardinalDirection | 'upRight' | 'downRight' | 'downLeft' | 'upLeft';
export const MOVE_KEYS = new Map<string, MoveDirection>([
  ['KeyW', 'up'],
  ['ArrowUp', 'up'],
  ['KeyA', 'left'],
  ['ArrowLeft', 'left'],
  ['KeyS', 'down'],
  ['ArrowDown', 'down'],
  ['KeyD', 'right'],
  ['ArrowRight', 'right'],
]);
const CARDINAL_DIRECTIONS: Record<CardinalDirection, TileCoord> = {
  up: [0, -1],
  left: [-1, 0],
  down: [0, 1],
  right: [1, 0],
};
export const HERO_NEIGHBORS: TileCoord[] = Object.values(CARDINAL_DIRECTIONS);
export const MOVE_DIRECTIONS: Record<MoveDirection, TileCoord> = {
  ...CARDINAL_DIRECTIONS,
  upRight: [1, -1],
  downRight: [1, 1],
  downLeft: [-1, 1],
  upLeft: [-1, -1],
};

export type CarryItem = 'wood' | 'meat';

export interface WoodDrop {
  local?: boolean;
  thrownFrom?: THREE.Vector3;
  id: string;
  mesh: THREE.Group;
  origin: THREE.Vector3;
  i: number;
  j: number;
  quantity: number;
  age: number;
}

export interface MeatDrop extends WoodDrop {
  kind: 'meat';
}

interface ArrowProjectile {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  stuck: boolean;
  flightLeft: number;
  ttl: number;
  ripple?: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
}

export interface BuildingSite {
  i: number;
  j: number;
  mesh: THREE.Group;
  stored: number;
}

export type HeroInteraction =
  | { kind: 'chop'; target: number; elapsed: number }
  | { kind: 'loot'; target: WoodDrop | MeatDrop; elapsed: number }
  | { kind: 'build'; target: BuildingSite; elapsed: number; amount: number };

export interface HeroCoopBridge {
  isConnected: () => boolean;
  sendTreeHit: (treeIndex: number) => void;
  sendWoodLoot: (dropId: string) => void;
  sendBlueprintPlace: (i: number, j: number) => void;
  sendWoodDeposit: (amount: number) => void;
}

export class HeroController {
  public readonly sheet: HTMLCanvasElement;
  public readonly tex: THREE.CanvasTexture;
  public readonly mat: THREE.MeshBasicMaterial;
  public readonly mesh: THREE.Mesh;
  public readonly marker: THREE.Sprite;

  public name = 'Rowan';
  public i: number;
  public j: number;
  public x: number;
  public z: number;
  public face: 1 | -1 = 1;
  public frame = 0;
  public crouch = 0;
  public swing = 0;
  public walkTime = 0;
  public step: { dx: number; dz: number; progress: number } | null = null;
  public path: TileCoord[] = [];
  public wood = 0;
  public meat = 0;
  public readonly fishCatches = FISH.map(() => 0);
  private carriedItem: CarryItem | null = null;
  private carryMesh: THREE.Group | null = null;
  private depositPending = false;
  private nextThrownDrop = 0;

  public get carrying(): CarryItem | null {
    return this.carriedItem && this[this.carriedItem] > 0 ? this.carriedItem : null;
  }

  public readonly heldMoves = new Map<string, MoveDirection>();
  public queuedMove: MoveDirection | null = null;
  public rodEquipped = false;
  public fishingPose: 'cast' | 'hold' | null = null;
  public axeEquipped = false;
  public bowEquipped = false;
  public placingBlueprint = false;
  public buildingSite: BuildingSite | null = null;
  public readonly woodDrops: WoodDrop[] = [];
  public readonly meatDrops: MeatDrop[] = [];
  public interaction: HeroInteraction | null = null;

  private readonly scene: THREE.Scene;
  private readonly grid: WorldGrid;
  private readonly buildings: WorldBuildings;
  private readonly vegetation: WorldVegetation;
  private readonly wildlife?: WorldWildlife;
  private readonly audio?: AudioEngine;
  private readonly fxNorm: Pool;
  private readonly logGeometry: THREE.CylinderGeometry;
  private readonly logMaterials: THREE.Material[];
  private readonly rippleGeo = new THREE.RingGeometry(0.8, 1, 24);
  private readonly arrowShaftGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.68, 5);
  private readonly arrowTipGeo = new THREE.ConeGeometry(0.052, 0.16, 5);
  private readonly arrowFletchGeo = new THREE.PlaneGeometry(0.14, 0.08);
  private readonly arrowShaftMat: THREE.Material;
  private readonly arrowTipMat: THREE.Material;
  private readonly arrowFletchMat = new THREE.MeshLambertMaterial({ color: 0xf0e4d2, side: THREE.DoubleSide });
  private readonly meatMat = new THREE.MeshLambertMaterial({ color: 0xa63a2b, flatShading: true });
  private readonly boneMat = new THREE.MeshLambertMaterial({ color: 0xeadfc8, flatShading: true });
  private readonly arrows: ArrowProjectile[] = [];
  private shotTime = BOW_SHOT_TIME;
  private shotTarget: (() => THREE.Vector3) | null = null;
  private readonly blueprintInk = new THREE.MeshBasicMaterial({ color: 0x56b8fc });
  private readonly blueprintLine = new THREE.BoxGeometry(1, 0.025, 0.055);
  private readonly toast: (msg: string, ms?: number) => void;
  private readonly focusHero: () => void;
  private readonly villagers: Villager[];
  private readonly coop: HeroCoopBridge;

  public onBuildStatusChange?: () => void;
  public onChopProgressChange?: (treeHits: number | null) => void;
  public onBlueprintModeChange?: (active: boolean) => void;
  public onAxeModeChange?: (active: boolean) => void;
  public onBowModeChange?: (active: boolean) => void;

  constructor(opts: {
    scene: THREE.Scene;
    grid: WorldGrid;
    buildings: WorldBuildings;
    vegetation: WorldVegetation;
    wildlife?: WorldWildlife;
    audio?: AudioEngine;
    TX: ProceduralTextures;
    MAT: SharedMaterials;
    fxNorm: Pool;
    villagers: Villager[];
    toast: (msg: string, ms?: number) => void;
    focusHero: () => void;
    coop: HeroCoopBridge;
    palette?: TravelerPalette;
  }) {
    this.scene = opts.scene;
    this.grid = opts.grid;
    this.buildings = opts.buildings;
    this.vegetation = opts.vegetation;
    this.wildlife = opts.wildlife;
    this.audio = opts.audio;
    this.fxNorm = opts.fxNorm;
    this.villagers = opts.villagers;
    this.toast = opts.toast;
    this.focusHero = opts.focusHero;
    this.coop = opts.coop;
    this.arrowShaftMat = opts.MAT.wood;
    this.arrowTipMat = opts.MAT.iron;
    this.arrowShaftGeo.rotateX(Math.PI / 2);
    this.arrowTipGeo.rotateX(Math.PI / 2);

    const pal = opts.palette ?? DEFAULT_TRAVELER_PALETTE;
    const sprite = characterSprite(
      opts.scene,
      {
        role: 'Traveler',
        skin: pal.skin,
        hair: pal.hair,
        shirt: pal.shirt,
        pants: pal.pants,
        shoes: '#2a1d14',
        hat: 'brim',
        hatCol: pal.hatCol,
        pack: true,
      },
      TRAVELER_FRAME_COUNT
    );
    this.sheet = sprite.sheet;
    this.tex = sprite.tex;
    this.mat = sprite.mat;
    this.mesh = sprite.mesh;

    const [spawnI, spawnJ] = opts.grid.reachList[0] ?? [22, 25];
    this.i = spawnI;
    this.j = spawnJ;
    this.x = wx(spawnI);
    this.z = wz(spawnJ);

    this.marker = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: opts.TX.arrow, depthTest: false, transparent: true })
    );
    this.marker.scale.set(0.36, 0.32, 1);
    this.marker.renderOrder = 8;
    opts.scene.add(this.marker);

    this.logGeometry = new THREE.CylinderGeometry(0.13, 0.15, 0.66, 7);
    const logEnds = new THREE.MeshLambertMaterial({ color: 0xd4a46d });
    this.logMaterials = [opts.MAT.trunk, logEnds, logEnds];
  }

  public setSpawnTile(x: number, z: number): void {
    this.x = x;
    this.z = z;
    this.i = Math.floor(x + 22);
    this.j = Math.floor(z + 22);
    this.step = null;
    this.path = [];
  }

  public canFish(): boolean {
    if (!this.rodEquipped || this.step) return false;
    return HERO_NEIGHBORS.some(([dx, dz]) => {
      const i = this.i + dx;
      const j = this.j + dz;
      return inGrid(i, j) && this.grid.TYPE[idx(i, j)] === T.RIVER;
    });
  }

  public clearMovement(): void {
    this.heldMoves.clear();
    this.queuedMove = null;
  }

  public setRodMode(active: boolean): void {
    this.rodEquipped = active;
    if (!active) return;
    this.setCarryItem(null);
    this.setAxeMode(false);
    this.setBowMode(false);
    this.setBlueprintMode(false);
    this.cancelInteraction();
    this.toast('Fishing rod equipped. Click nearby water from the shore.', 2200);
  }

  public setAxeMode(active: boolean): void {
    this.axeEquipped = active;
    if (active) {
      this.setRodMode(false);
      this.setCarryItem(null);
      if (this.bowEquipped) this.setBowMode(false);
      if (this.placingBlueprint) this.setBlueprintMode(false);
      this.toast('Axe equipped. Click or tap a tree.', 2200);
    } else if (this.interaction?.kind === 'chop') {
      this.cancelInteraction();
    }
    this.onAxeModeChange?.(active);
  }

  public setBowMode(active: boolean): void {
    this.bowEquipped = active;
    if (active) {
      this.setRodMode(false);
      this.setCarryItem(null);
      if (this.axeEquipped) this.setAxeMode(false);
      if (this.placingBlueprint) this.setBlueprintMode(false);
      if (this.interaction?.kind === 'chop' || this.interaction?.kind === 'build') {
        this.cancelInteraction();
      }
      this.toast('Bow equipped. Click a deer or anywhere to shoot.', 2400);
    }
    if (!active) this.cancelBowDraw();
    this.onBowModeChange?.(active);
  }

  public setBlueprintMode(active: boolean): void {
    this.placingBlueprint = active;
    if (active) {
      this.setRodMode(false);
      this.setCarryItem(null);
      if (this.axeEquipped) this.setAxeMode(false);
      if (this.bowEquipped) this.setBowMode(false);
    }
    this.onBlueprintModeChange?.(active);
    if (active) this.toast('Choose a clear, flat 3 × 3 area with room for a south-facing entrance.');
  }

  public routeToTile(i: number, j: number): TileCoord[] | null {
    const startI = this.i + (this.step?.dx ?? 0);
    const startJ = this.j + (this.step?.dz ?? 0);
    return this.grid.findPath(startI, startJ, i, j, HERO_NEIGHBORS);
  }

  public routeBeside(i: number, j: number): TileCoord[] | null {
    const startI = this.i + (this.step?.dx ?? 0);
    const startJ = this.j + (this.step?.dz ?? 0);
    let shortest: TileCoord[] | null = null;
    for (const [dx, dz] of HERO_NEIGHBORS) {
      const fromI = i - dx;
      const fromJ = j - dz;
      if (
        !this.grid.walkable(fromI, fromJ) ||
        this.grid.exitLv(idx(fromI, fromJ), dx, dz) !== this.grid.baseLv(idx(i, j))
      ) {
        continue;
      }
      const route = this.grid.findPath(startI, startJ, fromI, fromJ, HERO_NEIGHBORS);
      if (route && (!shortest || route.length < shortest.length)) shortest = route;
    }
    return shortest;
  }

  public walkToMapTile(i: number, j: number): void {
    const path = this.routeToTile(i, j);
    if (!path) {
      this.toast('That tile is unreachable.', 1500);
      return;
    }
    this.clearMovement();
    this.cancelInteraction();
    this.path = path;
    this.focusHero();
  }

  public isBlueprintTile(i: number, j: number): boolean {
    return !!this.buildingSite && Math.abs(i - this.buildingSite.i) <= 1 && Math.abs(j - this.buildingSite.j) <= 1;
  }

  public placeBlueprint(i: number, j: number): void {
    if (this.buildingSite) {
      this.toast('Finish the current house before placing another blueprint.');
      return;
    }
    const inside = (x: number, z: number) => Math.abs(x - i) <= 1 && Math.abs(z - j) <= 1;
    const level = this.grid.H[idx(i, j)];
    const footprint: number[] = [];
    for (let z = j - 1; z <= j + 1; z++) {
      for (let x = i - 1; x <= i + 1; x++) {
        const k = idx(x, z);
        if (
          !this.grid.walkable(x, z) ||
          (this.grid.TYPE[k] !== T.GRASS && this.grid.TYPE[k] !== T.FIELD) ||
          this.grid.stairs.has(k) ||
          this.grid.H[k] !== level ||
          this.buildings.nearDoor(x, z)
        ) {
          this.toast('Choose nine clear grass or field tiles on the same level.');
          return;
        }
        footprint.push(k);
      }
    }
    const entranceJ = j + 2;
    if (
      !this.grid.walkable(i, entranceJ) ||
      this.grid.stairs.has(idx(i, entranceJ)) ||
      this.grid.baseLv(idx(i, entranceJ)) !== level ||
      inside(this.i, this.j) ||
      inside(this.i + (this.step?.dx ?? 0), this.j + (this.step?.dz ?? 0)) ||
      this.villagers.some((v) => !v.hidden && inside(...v.tile())) ||
      this.woodDrops.some((drop) => inside(drop.i, drop.j))
    ) {
      this.toast('Keep the footprint empty and leave a clear tile south of the house.');
      return;
    }

    for (const k of footprint) this.grid.BLOCK[k] = 1;
    if (!this.routeToTile(i, entranceJ)) {
      for (const k of footprint) this.grid.BLOCK[k] = 0;
      this.toast('The hero needs a path to the south entrance.');
      return;
    }

    if (this.coop.isConnected()) {
      for (const k of footprint) this.grid.BLOCK[k] = 0;
      this.setBlueprintMode(false);
      this.coop.sendBlueprintPlace(i, j);
      return;
    }

    this.applyBlueprintLocal(i, j, true);
  }

  public applyBlueprintLocal(i: number, j: number, announce = true, placerName?: string): void {
    if (this.buildingSite) return;
    const inside = (x: number, z: number) => Math.abs(x - i) <= 1 && Math.abs(z - j) <= 1;
    const level = this.grid.H[idx(i, j)];
    for (let z = j - 1; z <= j + 1; z++) {
      for (let x = i - 1; x <= i + 1; x++) {
        this.grid.BLOCK[idx(x, z)] = 1;
      }
    }
    if (inside(this.i, this.j)) {
      this.i = i;
      this.j = j + 2;
      this.x = wx(this.i);
      this.z = wz(this.j);
      this.step = null;
    }
    this.cancelInteraction();
    this.clearMovement();
    this.path = [];
    for (const v of this.villagers) {
      if (v.path.some(([x, z]) => inside(x, z))) v.react();
    }

    const mesh = new THREE.Group();
    mesh.position.set(wx(i), level * TH + 0.045, wz(j));
    for (const [x, z, length, vertical] of [
      [0, -1.45, 2.9, false],
      [-1.45, 0, 2.9, true],
      [1.45, 0, 2.9, true],
      [-0.96, 1.45, 0.98, false],
      [0.96, 1.45, 0.98, false],
      [-0.46, 1.67, 0.44, true],
      [0.46, 1.67, 0.44, true],
    ] as const) {
      const lineMesh = new THREE.Mesh(this.blueprintLine, this.blueprintInk);
      lineMesh.position.set(x, 0, z);
      lineMesh.scale.x = length;
      if (vertical) lineMesh.rotation.y = Math.PI / 2;
      mesh.add(lineMesh);
    }
    this.scene.add(mesh);
    this.buildingSite = { i, j, mesh, stored: 0 };
    this.grid.refreshGrid();
    this.setBlueprintMode(false);
    this.onBuildStatusChange?.();
    if (announce) {
      this.toast(
        placerName
          ? `${placerName} placed a house blueprint! Bring 6 wood together.`
          : 'Blueprint placed. Bring 6 wood to build the house.'
      );
    }
  }

  public setCarryItem(item: CarryItem | null): void {
    if (item && this[item] === 0) return;
    if (this.carriedItem === item) return;
    if (this.interaction?.kind === 'build') this.cancelInteraction();
    if (item) {
      this.setRodMode(false);
      this.setAxeMode(false);
      this.setBowMode(false);
      this.setBlueprintMode(false);
    }
    if (this.carryMesh) this.scene.remove(this.carryMesh);
    this.carriedItem = item;
    this.carryMesh = item === 'wood' ? this.makeLogPile(1) : item === 'meat' ? this.makeMeatMesh() : null;
    if (this.carryMesh) this.scene.add(this.carryMesh);
    this.onBuildStatusChange?.();
  }

  public get throwLimit(): number {
    const item = this.carrying;
    return item && !(item === 'wood' && this.depositPending) ? this[item] : 0;
  }

  public throwCarriedItem(amount: number, cameraRight: THREE.Vector3): void {
    const item = this.carrying;
    if (!item || !Number.isInteger(amount) || amount < 1 || amount > this.throwLimit) return;
    this.cancelInteraction();
    this.clearMovement();
    this.path = [];
    const sideways = Math.abs(cameraRight.x) >= Math.abs(cameraRight.z);
    const dx = sideways ? Math.sign(cameraRight.x) * this.face : 0;
    const dz = sideways ? 0 : Math.sign(cameraRight.z) * this.face;
    const [i, j] = this.grid.canStep(this.i, this.j, dx, dz)
      ? [this.i + dx, this.j + dz]
      : this.nearestWalkableTile(this.i, this.j);
    const drop = item === 'wood'
      ? this.spawnWoodDrop(`thrown_${++this.nextThrownDrop}`, i, j, amount)
      : this.spawnMeatDrop(wx(i), wz(j), amount);
    drop.local = true;
    drop.thrownFrom = new V3(this.x, this.grid.groundY(this.x, this.z) + 0.66, this.z);
    drop.mesh.position.copy(drop.thrownFrom);
    this[item] -= amount;
    if (!this[item]) this.setCarryItem(null);
    else this.onBuildStatusChange?.();
  }

  public get deliveryLimit(): number {
    const site = this.buildingSite;
    return site && this.carrying === 'wood' && !this.depositPending
      ? Math.min(this.wood, HOUSE_WOOD_COST - site.stored)
      : 0;
  }

  public beginDelivery(amount: number): void {
    const site = this.buildingSite;
    if (!site || !Number.isInteger(amount) || amount < 1 || amount > this.deliveryLimit) return;
    this.startInteraction('build', site, site.i, site.j + 2, amount);
  }

  public resolveWoodDeposit(accepted = 0): void {
    if (!this.depositPending) return;
    this.depositPending = false;
    this.wood = Math.max(0, this.wood - accepted);
    if (!this.wood && this.carriedItem === 'wood') this.setCarryItem(null);
    else this.onBuildStatusChange?.();
  }

  private finishDelivery(site: BuildingSite, requested: number): void {
    if (site !== this.buildingSite) return;
    const amount = Math.min(requested, this.deliveryLimit);
    if (amount <= 0) return;

    if (this.coop.isConnected()) {
      this.depositPending = true;
      this.onBuildStatusChange?.();
      this.coop.sendWoodDeposit(amount);
      return;
    }

    this.wood -= amount;
    if (!this.wood) this.setCarryItem(null);
    this.applyWoodDepositLocal(site.stored + amount, amount, true);
  }

  public applyWoodDepositLocal(newStored: number, added: number, announce = true, depositor?: string): void {
    const site = this.buildingSite;
    if (!site) return;
    const prev = site.stored;
    site.stored = Math.min(HOUSE_WOOD_COST, newStored);
    if (site.stored < HOUSE_WOOD_COST && added > 0) {
      const pile = this.makeLogPile(added);
      pile.position.set(0.65, 0, -0.35 - prev * 0.1);
      site.mesh.add(pile);
      if (announce) {
        this.toast(depositor ? `${depositor} delivered ${added} wood.` : `Delivered ${added} wood.`);
      }
    }
    this.onBuildStatusChange?.();
    if (site.stored >= HOUSE_WOOD_COST && !this.coop.isConnected()) {
      this.applyHouseCompletedLocal(site.i, site.j, 'thatch', announce);
    }
  }

  public applyHouseCompletedLocal(i: number, j: number, roof = 'thatch', announce = true, builder?: string): void {
    if (this.buildingSite && this.buildingSite.i === i && this.buildingSite.j === j) {
      this.scene.remove(this.buildingSite.mesh);
      this.buildingSite = null;
    }
    for (let z = j - 1; z <= j + 1; z++) {
      for (let x = i - 1; x <= i + 1; x++) {
        this.grid.BLOCK[idx(x, z)] = 1;
      }
    }
    const home = this.buildings.makeHouse(i, j, 'S', { roof });
    this.buildings.doorTiles.push(home.door);
    this.grid.refreshGrid();
    this.onBuildStatusChange?.();
    if (announce) {
      this.toast(builder ? `${builder} finished the house · 100%!` : 'House complete · 100%');
    }
  }

  public startInteraction(
    kind: HeroInteraction['kind'],
    target: number | WoodDrop | MeatDrop | BuildingSite,
    i: number,
    j: number,
    amount = 0
  ): void {
    if (kind !== 'build' && this.interaction?.kind === kind && this.interaction.target === target) return;
    const path = kind === 'build' || (kind === 'loot' && i === this.i && j === this.j)
      ? this.routeToTile(i, j)
      : this.routeBeside(i, j);
    if (!path) {
      this.toast(
        kind === 'chop'
          ? 'No path to this tree.'
          : kind === 'loot'
            ? 'No path to the drop.'
            : 'No path to the blueprint entrance.'
      );
      return;
    }
    this.clearMovement();
    this.cancelInteraction();
    this.path = path;
    this.cancelBowDraw();
    if (kind === 'chop') {
      this.interaction = { kind: 'chop', target: target as number, elapsed: 0 };
      this.onChopProgressChange?.(this.vegetation.trees[target as number]?.hits ?? 0);
    } else if (kind === 'loot') {
      this.interaction = { kind: 'loot', target: target as WoodDrop | MeatDrop, elapsed: 0 };
    } else {
      this.interaction = { kind: 'build', target: target as BuildingSite, elapsed: 0, amount };
    }
    this.focusHero();
  }

  public cancelInteraction(): void {
    if (!this.interaction) return;
    if (this.interaction.kind === 'loot') {
      this.interaction.target.mesh.position.copy(this.interaction.target.origin);
    }
    this.interaction = null;
    this.path = [];
    this.onChopProgressChange?.(null);
  }

  public makeLogPile(quantity = 3): THREE.Group {
    const mesh = new THREE.Group();
    for (let n = 0; n < quantity; n++) {
      const log = new THREE.Mesh(this.logGeometry, this.logMaterials);
      log.castShadow = true;
      log.receiveShadow = true;
      log.rotation.set(0, 0.25 * (n - 1), Math.PI / 2);
      log.position.set(0, n === 2 ? 0.34 : 0.15, n === 2 ? 0 : (n * 2 - 1) * 0.15);
      mesh.add(log);
    }
    return mesh;
  }

  public spawnWoodDrop(id: string, i: number, j: number, quantity = 3): WoodDrop {
    const existing = this.woodDrops.find((d) => d.id === id);
    if (existing) return existing;
    const mesh = this.makeLogPile(Math.min(quantity, 3));
    const origin = new V3(wx(i), this.grid.groundY(wx(i), wz(j)) + 0.04, wz(j));
    mesh.position.copy(origin);
    const drop: WoodDrop = { id, mesh, origin, i, j, quantity, age: 0 };
    mesh.userData.drop = drop;
    this.woodDrops.push(drop);
    this.scene.add(mesh);
    return drop;
  }

  public removeWoodDrop(dropId: string): WoodDrop | null {
    const index = this.woodDrops.findIndex((d) => d.id === dropId);
    if (index === -1) return null;
    const [drop] = this.woodDrops.splice(index, 1);
    this.scene.remove(drop.mesh);
    if (this.interaction?.kind === 'loot' && this.interaction.target === drop) {
      this.interaction = null;
    }
    return drop;
  }

  private makeArrowMesh(): THREE.Group {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(this.arrowShaftGeo, this.arrowShaftMat);
    shaft.castShadow = true;
    g.add(shaft);
    const tip = new THREE.Mesh(this.arrowTipGeo, this.arrowTipMat);
    tip.position.z = 0.38;
    g.add(tip);
    for (const rotZ of [0, Math.PI / 2]) {
      const f = new THREE.Mesh(this.arrowFletchGeo, this.arrowFletchMat);
      f.position.z = -0.26;
      f.rotation.y = Math.PI / 2;
      f.rotation.x = rotZ;
      g.add(f);
    }
    return g;
  }

  private makeMeatMesh(): THREE.Group {
    const g = new THREE.Group();
    const cut = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 5), this.meatMat);
    cut.scale.set(1.25, 0.85, 0.9);
    cut.position.set(0, 0.16, 0);
    cut.castShadow = true;
    cut.receiveShadow = true;
    g.add(cut);
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.28, 6), this.boneMat);
    bone.rotation.z = Math.PI / 2;
    bone.position.set(0.2, 0.16, 0);
    g.add(bone);
    return g;
  }

  private nearestWalkableTile(ci: number, cj: number): TileCoord {
    const i0 = clamp(ci, 0, N - 1);
    const j0 = clamp(cj, 0, N - 1);
    if (this.grid.walkable(i0, j0)) return [i0, j0];
    for (let r = 1; r <= 3; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          const i = i0 + di;
          const j = j0 + dj;
          if (this.grid.walkable(i, j)) return [i, j];
        }
      }
    }
    return [this.i, this.j];
  }

  public spawnMeatDrop(x: number, z: number, quantity = DEER_MEAT_YIELD): MeatDrop {
    const [i, j] = this.nearestWalkableTile(ti(x), tj(z));
    const mesh = this.makeMeatMesh();
    const origin = new V3(wx(i), this.grid.groundY(wx(i), wz(j)) + 0.04, wz(j));
    mesh.position.copy(origin);
    const drop: MeatDrop = {
      id: `meat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind: 'meat',
      mesh,
      origin,
      i,
      j,
      quantity,
      age: 0,
    };
    mesh.userData.drop = drop;
    this.meatDrops.push(drop);
    this.scene.add(mesh);
    return drop;
  }

  public removeMeatDrop(dropId: string): MeatDrop | null {
    const index = this.meatDrops.findIndex((d) => d.id === dropId);
    if (index === -1) return null;
    const [drop] = this.meatDrops.splice(index, 1);
    this.scene.remove(drop.mesh);
    if (this.interaction?.kind === 'loot' && this.interaction.target === drop) {
      this.interaction = null;
    }
    return drop;
  }

  public shootArrowAt(target: () => THREE.Vector3, camRight: THREE.Vector3): void {
    if (!this.bowEquipped || this.shotTime < BOW_SHOT_TIME) return;
    this.shotTime = 0;
    this.shotTarget = target;
    this.clearMovement();
    this.cancelInteraction();
    this.path = [];
    this.faceShot(target(), camRight);
    this.focusHero();
  }

  private cancelBowDraw(): void {
    if (!this.shotTarget) return;
    this.shotTarget = null;
    this.shotTime = BOW_SHOT_TIME;
  }

  private faceShot(target: THREE.Vector3, camRight: THREE.Vector3): void {
    const horizontal = (target.x - this.x) * camRight.x + (target.z - this.z) * camRight.z;
    if (Math.abs(horizontal) > 0.1) this.face = horizontal < 0 ? -1 : 1;
  }

  private releaseArrow(target: THREE.Vector3): void {
    const origin = new V3(this.x, this.grid.groundY(this.x, this.z) + 0.8, this.z);
    const dx = target.x - origin.x;
    const dz = target.z - origin.z;
    const dist = Math.hypot(dx, dz);
    const reach = Math.min(dist, BOW_RANGE);
    const scale = dist > BOW_RANGE ? BOW_RANGE / dist : 1;
    const aimY = dist > BOW_RANGE
      ? this.grid.groundY(origin.x + dx * scale, origin.z + dz * scale) - 0.01
      : target.y;
    const flightTime = Math.max(0.14, reach / ARROW_SPEED);
    const vel = new V3(
      dx * scale / flightTime,
      (aimY - origin.y + 0.5 * ARROW_GRAVITY * flightTime * flightTime) / flightTime,
      dz * scale / flightTime
    );

    const mesh = this.makeArrowMesh();
    mesh.position.copy(origin);
    mesh.lookAt(origin.x + vel.x, origin.y + vel.y, origin.z + vel.z);
    this.scene.add(mesh);
    this.arrows.push({
      mesh, pos: origin, vel, stuck: false,
      flightLeft: dist > BOW_RANGE ? flightTime : Infinity,
      ttl: 2,
    });
    this.audio?.bowShot();
  }

  private hitWater(arrow: ArrowProjectile, x: number, z: number): void {
    const material = new THREE.MeshBasicMaterial({
      color: 0xc8f5ff, transparent: true, opacity: 0.72, depthWrite: false,
    });
    const ripple = new THREE.Mesh(this.rippleGeo, material);
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set(x, WATER_Y + 0.015, z);
    ripple.scale.setScalar(0.09);
    ripple.renderOrder = 3;
    this.scene.add(ripple);

    arrow.pos.set(x, WATER_Y, z);
    arrow.mesh.position.copy(arrow.pos);
    arrow.mesh.lookAt(x + arrow.vel.x, WATER_Y + arrow.vel.y, z + arrow.vel.z);
    arrow.stuck = true;
    arrow.ttl = RIPPLE_TIME;
    arrow.ripple = ripple;
  }

  private updateArrows(dt: number): void {
    for (let idxA = this.arrows.length - 1; idxA >= 0; idxA--) {
      const arrow = this.arrows[idxA];
      if (arrow.stuck) {
        arrow.ttl -= dt;
        if (arrow.ttl <= 0) {
          this.scene.remove(arrow.mesh);
          if (arrow.ripple) {
            this.scene.remove(arrow.ripple);
            arrow.ripple.material.dispose();
          }
          this.arrows.splice(idxA, 1);
        } else if (arrow.ripple) {
          const age = RIPPLE_TIME - arrow.ttl;
          arrow.mesh.position.y = WATER_Y - age * 2.8;
          arrow.mesh.visible = age < 0.3;
          arrow.ripple.scale.setScalar(0.09 + age * 0.66);
          arrow.ripple.material.opacity = 0.72 * (arrow.ttl / RIPPLE_TIME) ** 2;
        }
        continue;
      }

      const step = Math.min(dt, arrow.flightLeft);
      arrow.flightLeft -= step;
      const previousY = arrow.pos.y;
      arrow.pos.addScaledVector(arrow.vel, step);
      arrow.pos.y -= 0.5 * ARROW_GRAVITY * step * step;
      arrow.vel.y -= ARROW_GRAVITY * step;

      if (arrow.pos.y <= WATER_Y) {
        const fraction = previousY > WATER_Y
          ? (WATER_Y - arrow.pos.y) / (previousY - arrow.pos.y)
          : 0;
        const x = arrow.pos.x - arrow.vel.x * step * fraction;
        const z = arrow.pos.z - arrow.vel.z * step * fraction;
        const i = ti(x);
        const j = tj(z);
        if (inGrid(i, j) && this.grid.TYPE[idx(i, j)] === T.RIVER) {
          this.hitWater(arrow, x, z);
          continue;
        }
      }
      arrow.mesh.position.copy(arrow.pos);
      arrow.mesh.lookAt(arrow.pos.x + arrow.vel.x, arrow.pos.y + arrow.vel.y, arrow.pos.z + arrow.vel.z);

      let hitDeer = false;
      if (this.wildlife) {
        for (const deer of this.wildlife.deer) {
          if (!deer.alive) continue;
          const dist = Math.hypot(
            arrow.pos.x - deer.pos.x,
            arrow.pos.y - (deer.pos.y + 0.72),
            arrow.pos.z - deer.pos.z
          );
          if (dist < 0.85) {
            const res = this.wildlife.hitDeer(deer.id);
            this.scene.remove(arrow.mesh);
            this.arrows.splice(idxA, 1);
            hitDeer = true;
            if (res.hit) {
              this.audio?.arrowHit(res.pos.x, res.pos.z);
              for (let k = 0; k < (res.defeated ? 14 : 7); k++) {
                this.fxNorm.spawn(
                  res.pos.x,
                  res.pos.y + 0.7,
                  res.pos.z,
                  R(-2, 2),
                  R(1, 3),
                  R(-2, 2),
                  0.85,
                  0.32,
                  0.24,
                  0.45,
                  0.3,
                  1,
                  5,
                  1.4,
                  0.45
                );
              }
              if (res.defeated) {
                this.spawnMeatDrop(res.pos.x, res.pos.z, DEER_MEAT_YIELD);
                this.toast('Deer hunted! Click the venison to collect it.', 2200);
              } else {
                this.toast('Deer hit! Shoot once more before it escapes!', 1800);
              }
            }
            break;
          }
        }
      }
      if (hitDeer) continue;

      const gy = this.grid.groundY(arrow.pos.x, arrow.pos.z);
      if (arrow.pos.y <= gy || arrow.flightLeft === 0) {
        const i = ti(arrow.pos.x);
        const j = tj(arrow.pos.z);
        if (inGrid(i, j) && this.grid.TYPE[idx(i, j)] === T.RIVER) {
          this.hitWater(arrow, arrow.pos.x, arrow.pos.z);
          continue;
        }
        arrow.pos.y = gy + 0.03;
        arrow.mesh.position.copy(arrow.pos);
        arrow.stuck = true;
      }
    }
  }

  public applyTreeHitVisualAndFX(instance: number, hits: number, spawnLocalDrop = false, dropId?: string): void {
    const tree = this.vegetation.trees[instance];
    if (!tree) return;
    this.vegetation.setTreeHitVisual(instance, hits);
    const felled = hits >= STRIKES_TO_FELL;
    for (let n = 0; n < (felled ? 16 : 7); n++) {
      this.fxNorm.spawn(
        tree.x,
        this.grid.groundY(tree.x, tree.z) + 0.4,
        tree.z,
        R(-2, 2),
        R(1, 3),
        R(-2, 2),
        0.72,
        0.46,
        0.22,
        0.5,
        0.35,
        1,
        5,
        1.5,
        0.5
      );
    }
    if (this.interaction?.kind === 'chop' && this.interaction.target === instance) {
      this.onChopProgressChange?.(hits);
    }
    if (felled && spawnLocalDrop) {
      this.spawnWoodDrop(dropId ?? `local_${instance}_${Date.now()}`, tree.i, tree.j, 3);
      this.toast('Click or tap the logs to collect wood.', 2000);
    }
  }

  private hitTree(instance: number): void {
    const tree = this.vegetation.trees[instance];
    if (!tree || tree.chopped) return;
    if (this.coop.isConnected()) {
      this.coop.sendTreeHit(instance);
      return;
    }
    this.applyTreeHitVisualAndFX(instance, Math.min(STRIKES_TO_FELL, tree.hits + 1), true);
  }

  private updateInteraction(dt: number, camRight: THREE.Vector3): number {
    const action = this.interaction!;
    const chopping = action.kind === 'chop';
    const building = action.kind === 'build';
    const target = chopping
      ? this.vegetation.trees[action.target]
      : building
        ? action.target.mesh.position
        : action.target.origin;
    const horizontal = (target.x - this.x) * camRight.x + (target.z - this.z) * camRight.z;
    if (Math.abs(horizontal) > 0.15) this.face = (Math.sign(horizontal) || 1) as 1 | -1;
    const previous = action.elapsed;
    action.elapsed += dt;

    if (chopping) {
      if (previous < 0.32 && action.elapsed >= 0.32) this.hitTree(action.target);
      if (action.elapsed < 0.32) return 7;
      if (action.elapsed < 0.54) return 8;
      const tree = this.vegetation.trees[action.target];
      if (action.elapsed >= 0.78) {
        if (tree.chopped) this.cancelInteraction();
        else action.elapsed = 0;
      }
      return 4;
    }

    if (building) {
      if (action.elapsed < 0.54) return this.axeEquipped ? 10 : 9;
      this.finishDelivery(action.target, action.amount);
      this.interaction = null;
      return this.axeEquipped ? 4 : 0;
    }

    const drop = action.target;
    const lift = clamp((action.elapsed - 0.18) / 0.36, 0, 1);
    drop.mesh.position.set(
      lerp(drop.origin.x, this.x, lift),
      lerp(drop.origin.y, this.grid.groundY(this.x, this.z) + 0.65, lift) + Math.sin(lift * Math.PI) * 0.5,
      lerp(drop.origin.z, this.z, lift)
    );
    if (lift < 1) return this.axeEquipped ? 10 : 9;

    if ('kind' in drop && drop.kind === 'meat') {
      this.removeMeatDrop(drop.id);
      this.meat += drop.quantity;
      this.onBuildStatusChange?.();
      this.toast(`+${drop.quantity} venison`, 1600);
      this.interaction = null;
      return this.axeEquipped ? 4 : 0;
    }

    if (this.coop.isConnected() && !drop.local) {
      this.interaction = null;
      drop.mesh.position.copy(drop.origin);
      this.coop.sendWoodLoot(drop.id);
      return this.axeEquipped ? 4 : 0;
    }

    this.removeWoodDrop(drop.id);
    this.wood += drop.quantity;
    this.onBuildStatusChange?.();
    this.toast(`+${drop.quantity} wood`, 1600);
    this.interaction = null;
    return this.axeEquipped ? 4 : 0;
  }

  public update(dt: number, camYaw: number, camRight: THREE.Vector3): void {
    this.mesh.visible = this.marker.visible = true;
    if (this.grid.gridOverlay) this.grid.gridOverlay.visible = true;
    if (this.buildingSite) this.buildingSite.mesh.visible = true;
    this.shotTime = Math.min(BOW_SHOT_TIME, this.shotTime + dt);
    this.updateArrows(dt);

    if (!this.step && !this.shotTarget) {
      const direction = this.queuedMove ?? [...this.heldMoves.values()].at(-1);
      this.queuedMove = null;
      let dx = 0;
      let dz = 0;
      if (direction) {
        const [right, back] = MOVE_DIRECTIONS[direction];
        const quadrant = Math.round(camYaw / (Math.PI / 2));
        const cos = Math.round(Math.cos((quadrant * Math.PI) / 2));
        const sin = Math.round(Math.sin((quadrant * Math.PI) / 2));
        dx = right * cos + back * sin;
        dz = back * cos - right * sin;
      } else if (this.path.length) {
        const [i, j] = this.path.shift()!;
        dx = i - this.i;
        dz = j - this.j;
      }
      if ((dx || dz) && this.grid.canStep(this.i, this.j, dx, dz)) {
        this.step = { dx, dz, progress: 0 };
        const horizontal = dx * camRight.x + dz * camRight.z;
        if (Math.abs(horizontal) > 0.25) this.face = (Math.sign(horizontal) || 1) as 1 | -1;
      }
    }

    let frame = 0;
    if (this.step) {
      const step = this.step;
      step.progress = Math.min(1, step.progress + dt * 4.5);
      this.x = wx(this.i) + step.dx * step.progress;
      this.z = wz(this.j) + step.dz * step.progress;
      this.walkTime += dt * 12;
      frame = [1, 0, 2, 0][Math.floor(this.walkTime) % 4];
      if (step.progress === 1) {
        this.i += step.dx;
        this.j += step.dz;
        this.step = null;
      }
    }
    if (this.shotTarget) {
      const target = this.shotTarget();
      this.faceShot(target, camRight);
      if (this.shotTime >= BOW_DRAW_TIME) {
        this.releaseArrow(target);
        this.shotTarget = null;
      }
    }
    if (!this.step && this.rodEquipped && this.fishingPose) {
      frame = this.fishingPose === 'hold' ? FISH_HOLD_FRAME : FISH_CAST_FRAME;
    }
    if (this.axeEquipped) frame += 4;
    if (this.interaction && !this.step && !this.path.length) {
      frame = this.updateInteraction(dt, camRight);
    } else if (this.bowEquipped) {
      frame += BOW_IDLE_FRAME;
      if (this.shotTime < 0.1) frame = BOW_RAISE_FRAME;
      else if (this.shotTime < BOW_DRAW_TIME) frame = BOW_RAISE_FRAME + 1;
      else if (this.shotTime < BOW_RELEASE_END) frame = BOW_RAISE_FRAME + 2;
      else if (this.shotTime < BOW_SHOT_TIME) frame = BOW_RAISE_FRAME + 3;
    }

    for (const drop of [...this.woodDrops, ...this.meatDrops]) {
      drop.mesh.visible = true;
      if (this.interaction?.kind === 'loot' && this.interaction.target === drop && this.interaction.elapsed > 0) continue;
      drop.age = Math.min(1, drop.age + dt * 3);
      if (drop.thrownFrom) {
        drop.mesh.position.lerpVectors(drop.thrownFrom, drop.origin, drop.age);
        if (drop.age === 1) delete drop.thrownFrom;
      } else {
        drop.mesh.position.y = drop.origin.y;
      }
      drop.mesh.position.y += Math.sin(drop.age * Math.PI) * 0.45;
    }

    const y = this.grid.groundY(this.x, this.z);
    const elapsed = this.interaction?.elapsed ?? 0;
    const crouch = frame === 9 || frame === 10 ? Math.sin(Math.PI * clamp(elapsed / 0.54, 0, 1)) : 0;
    const swing =
      frame === 7
        ? 0.14 * clamp(elapsed / 0.32, 0, 1)
        : frame === 8
          ? -0.27 * clamp(1 - (elapsed - 0.32) / 0.22, 0, 1)
          : frame === BOW_RAISE_FRAME + 2
            ? -0.1 * (BOW_RELEASE_END - this.shotTime) / (BOW_RELEASE_END - BOW_DRAW_TIME)
            : 0;
    this.frame = frame;
    this.crouch = crouch;
    this.swing = swing;

    this.mesh.position.set(this.x, y - 0.19 * crouch, this.z);
    this.mesh.rotation.z = this.face * (swing - 0.23 * crouch);
    this.mesh.rotation.y = camYaw;
    this.mesh.scale.x = this.face;
    this.tex.offset.x = frame * this.tex.repeat.x;
    this.marker.position.set(this.x, y + 1.85, this.z);
    if (this.carryMesh) {
      this.carryMesh.visible = this.carrying !== null;
      this.carryMesh.position.set(
        this.x + camRight.z * -0.22 + camRight.x * this.face * 0.24,
        y + 0.66 - 0.19 * crouch,
        this.z + camRight.x * 0.22 + camRight.z * this.face * 0.24
      );
      this.carryMesh.rotation.y = camYaw;
    }
  }
}
