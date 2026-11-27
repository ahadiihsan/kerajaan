import { BITE_ANIMATION, CAST_FLIGHT, FishingVisuals } from './FishingVisuals';
import { CATCH_BAR_HEIGHT, FISH, FishingRound } from '../core/Fishing';
import * as THREE from 'three';
import { clamp, lerp, pick, R, V3 } from '../utils/math';
import { fmtTime, phaseName, PRESETS, weatherName, world } from '../core/WorldState';
import { idx, inGrid, N, ORIGIN, PCW, T, ti, tj, WATER_Y, WorldGrid } from '../world/WorldGrid';
import type { ProceduralTextures } from '../world/Textures';
import type { WorldBuildings } from '../world/Buildings';
import type { WorldVegetation } from '../world/Vegetation';
import type { WorldWildlife } from '../world/Wildlife';
import type { Pool } from '../core/Particles';
import type { AudioEngine } from '../core/AudioEngine';
import type { Engine } from '../core/Engine';
import type { Dragon } from '../entities/Dragon';
import { HOUSE_WOOD_COST, MOVE_KEYS, STRIKES_TO_FELL, type HeroController, type MoveDirection } from '../entities/HeroController';
import type { Villager } from '../entities/Villager';
import { itemIcon, type ItemIcon } from './ItemIcons';
import type { MultiplayerManager } from '../multiplayer/MultiplayerManager';

type BagEntry = {
  id: ItemIcon;
  name: string;
  count?: () => number;
  active: () => boolean;
  equip: (active: boolean) => void;
};

const $ = (id: string) => document.getElementById(id)!;
const STICK_DIRECTIONS: MoveDirection[] = ['right', 'downRight', 'down', 'downLeft', 'left', 'upLeft', 'up', 'upRight'];

export class HUD {
  public followHero = true;
  public follow = false;
  public selected: Villager | null = null;
  public readonly selRing: THREE.Mesh;
  public readonly selArrow: THREE.Sprite;

  private bannerTimer = 0;
  private toastTimer = 0;
  private uiT = 0;
  private hoverT = 0;
  private invKey = '';
  private statKey = '';
  private bubbleUntil = 0;
  private dragMode: 'orbit' | 'pan' | null = null;
  private downPos: { x: number; y: number } | null = null;
  private pinch0 = 0;
  private stickPointer: number | null = null;
  private readonly movePad = $('movePad');
  private readonly moveThumb = $('moveThumb');
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly labelPoint = new V3();
  private readonly npcNameRange = 5;

  private readonly pctx: CanvasRenderingContext2D;
  private readonly bag = $('bag') as HTMLDialogElement;
  private readonly fishingPanel = $('fishing');
  private readonly fishingTap = $('fishingTap') as HTMLButtonElement;
  private readonly fishingBar = $('fishingBar');
  private readonly fishingFish = $('fishingFish');
  private readonly fishingProgress = $('fishingProgress') as HTMLProgressElement;
  private fishingRound: FishingRound | null = null;
  private cast: { target: THREE.Vector3; elapsed: number; biteAt: number } | null = null;
  private recastIn = 0;
  private catchTime = 0;
  private readonly autoFish = $('autoFish') as HTMLInputElement;
  private catchColor = '#ffffff';
  private readonly fishingVisuals: FishingVisuals;
  private readonly quantityDialog = $('itemQuantity') as HTMLDialogElement;
  private quantityAction: 'throw' | 'deposit' = 'throw';
  private readonly bagEntries: BagEntry[] = [
    { id: 'axe', name: 'Axe', active: () => this.hero.axeEquipped, equip: (active) => this.hero.setAxeMode(active) },
    { id: 'bow', name: 'Bow', active: () => this.hero.bowEquipped, equip: (active) => this.hero.setBowMode(active) },
    { id: 'blueprint', name: 'Blueprint', active: () => this.hero.placingBlueprint, equip: (active) => {
      if (active && this.hero.buildingSite) this.toast('Finish the current house before placing another blueprint.');
      else this.hero.setBlueprintMode(active);
    } },
    { id: 'rod', name: 'Fishing Rod', active: () => this.hero.rodEquipped, equip: (active) => this.hero.setRodMode(active) },
    { id: 'wood', name: 'Wood', count: () => this.hero.wood, active: () => this.hero.carrying === 'wood', equip: (active) => this.hero.setCarryItem(active ? 'wood' : null) },
    { id: 'meat', name: 'Venison', count: () => this.hero.meat, active: () => this.hero.carrying === 'meat', equip: (active) => this.hero.setCarryItem(active ? 'meat' : null) },
  ];
  private readonly hotbar = this.bagEntries.filter(({ id }) => id !== 'rod') as (BagEntry | null)[];
  private readonly slotButtons: HTMLButtonElement[] = [];
  private readonly slotSelectors = new Map<BagEntry, HTMLSelectElement>();
  private readonly bagCounts = new Map<BagEntry, HTMLElement>();
  private readonly chatPanel = $('chatPanel');
  private readonly chatInput = $('chatInput') as HTMLInputElement;
  private readonly chatLog = $('chatLog');
  private readonly heroNameLabel: HTMLDivElement;
  private readonly npcNameLabels: HTMLDivElement[];
  private readonly speechBubble: HTMLSpanElement;

  private readonly engine: Engine;
  private readonly grid: WorldGrid;
  private readonly buildings: WorldBuildings;
  private readonly vegetation: WorldVegetation;
  private readonly wildlife: WorldWildlife;
  private readonly mapSurfaces: THREE.Mesh[];
  private readonly fxNorm: Pool;
  private readonly audio: AudioEngine;
  private readonly dragon: Dragon;
  private readonly villagers: Villager[];
  private readonly hero: HeroController;
  private readonly multiplayer: MultiplayerManager;

  constructor(opts: {
    engine: Engine;
    grid: WorldGrid;
    buildings: WorldBuildings;
    vegetation: WorldVegetation;
    wildlife: WorldWildlife;
    mapSurfaces: THREE.Mesh[];
    TX: ProceduralTextures;
    fxNorm: Pool;
    audio: AudioEngine;
    dragon: Dragon;
    villagers: Villager[];
    hero: HeroController;
    multiplayer: MultiplayerManager;
  }) {
    this.engine = opts.engine;
    this.fishingVisuals = new FishingVisuals(opts.engine.scene);
    this.grid = opts.grid;
    this.buildings = opts.buildings;
    this.vegetation = opts.vegetation;
    this.wildlife = opts.wildlife;
    this.mapSurfaces = opts.mapSurfaces;
    this.fxNorm = opts.fxNorm;
    this.audio = opts.audio;
    this.dragon = opts.dragon;
    this.villagers = opts.villagers;
    this.hero = opts.hero;
    this.multiplayer = opts.multiplayer;

    this.selRing = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.55, 28),
      new THREE.MeshBasicMaterial({
        color: 0xffd36a,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.selRing.rotation.x = -Math.PI / 2;
    this.selRing.visible = false;
    opts.engine.scene.add(this.selRing);

    this.selArrow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: opts.TX.arrow, depthTest: false, transparent: true })
    );
    this.selArrow.scale.set(0.42, 0.38, 1);
    this.selArrow.visible = false;
    this.selArrow.renderOrder = 9;
    opts.engine.scene.add(this.selArrow);

    this.pctx = ($('portrait') as HTMLCanvasElement).getContext('2d')!;
    this.pctx.imageSmoothingEnabled = false;

    this.heroNameLabel = this.createNameLabel(this.hero.name, true);
    this.npcNameLabels = this.villagers.map((v) => this.createNameLabel(v.name));
    this.speechBubble = document.createElement('span');
    this.speechBubble.id = 'speechBubble';
    this.speechBubble.className = 'hide';
    this.heroNameLabel.append(this.speechBubble);

    this.bindInventory();
    this.bindFishing();
    this.hero.onBuildStatusChange = () => this.refreshBuildStatus();
    this.hero.onChopProgressChange = (hits) => this.showChopProgress(hits);
    this.bindUI();
    this.bindPointerEvents();
    this.bindKeyboardEvents();
    this.syncEvents();
    this.syncFollow();
    this.refreshBuildStatus();
  }

  private createNameLabel(name: string, isHero = false): HTMLDivElement {
    const label = document.createElement('div');
    label.className = isHero ? 'nameTag heroTag hide' : 'nameTag hide';
    const b = document.createElement('b');
    b.textContent = name;
    label.append(b);
    $('worldLabels').append(label);
    return label;
  }

  public setMultiplayerStatus(connected: boolean, playerCount: number): void {
    const badge = $('mpStatus');
    badge.classList.toggle('on', connected);
    badge.textContent = connected ? `Online · ${playerCount} traveler${playerCount === 1 ? '' : 's'}` : 'Offline · 1 online';
  }

  public appendChatMessage(name: string, message: string, isSystem = false): void {
    const row = document.createElement('li');
    if (isSystem) {
      row.className = 'sys';
      row.textContent = message;
    } else {
      const b = document.createElement('b');
      b.textContent = name;
      row.append(b, `  ${message}`);
    }
    this.chatLog.append(row);
    if (this.chatLog.children.length > 30) this.chatLog.firstElementChild?.remove();
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  public showHeroSpeech(message: string): void {
    this.speechBubble.textContent = message;
    this.bubbleUntil = performance.now() + 6000;
  }

  public banner(title: string, sub: string, style = 'gold', dur = 3800): void {
    const b = $('banner');
    b.querySelector('b')!.textContent = title;
    b.querySelector('span')!.textContent = sub;
    b.className = `show ${style}`;
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => (b.className = style), dur);
  }

  public toast = (msg: string, ms = 3200): void => {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), ms);
  };

  public applyPreset(name: string, dur = 2.4): Promise<void> {
    const [tt, ww] = PRESETS[name];
    const t0 = world.time;
    const w0 = world.weather;
    const dt = (((tt - t0) % 24) + 24) % 24;
    world.flow = false;
    ($('flow') as HTMLInputElement).checked = false;
    return this.engine.tween(dur, (k) => {
      world.time = (t0 + dt * k) % 24;
      world.weather = lerp(w0, ww, k);
    });
  }

  public startFestival(): void {
    if (world.festival) return;
    if (world.raid) this.endRaid(true);
    world.festival = true;
    this.buildings.festGroup.visible = true;
    this.banner('🎉 HARVEST FESTIVAL 🎉', 'The bonfire roars — lanterns, music & dancing in the plaza!');
    this.audio.bell(3);
    for (let k = 0; k < 220; k++) {
      const col = pick([
        [0.95, 0.3, 0.25],
        [1, 0.85, 0.2],
        [0.3, 0.85, 0.4],
        [0.3, 0.55, 1],
        [0.75, 0.4, 1],
      ]);
      this.fxNorm.spawn(
        PCW.x,
        PCW.y + 1,
        PCW.z,
        R(-5, 5),
        R(6, 12),
        R(-5, 5),
        col[0],
        col[1],
        col[2],
        R(0.5, 0.9),
        R(2.5, 4),
        6,
        1.8,
        0,
        1
      );
    }
    this.villagers.forEach((v) => v.react());
    this.syncEvents();
  }

  public endFestival(silent = false): void {
    if (!world.festival) return;
    world.festival = false;
    this.buildings.festGroup.visible = false;
    if (!silent) this.banner('🌾 The festival winds down', 'Villagers drift home, humming the harvest jig.');
    this.villagers.forEach((v) => v.react());
    this.syncEvents();
  }

  public startRaid(): void {
    if (world.raid) return;
    if (world.festival) this.endFestival(true);
    world.raid = true;
    world.raidT = 0;
    this.dragon.enter();
    this.banner('🐉 DRAGON RAID! 🐉', 'Guards — draw your swords! Everyone else — get indoors!', 'red', 4500);
    this.audio.bell(6, true);
    this.villagers.forEach((v) => v.react());
    this.syncEvents();
  }

  public endRaid(silent = false): void {
    if (!world.raid) return;
    world.raid = false;
    world.raidEndedAt = world.T;
    this.dragon.leave();
    if (!silent) this.banner('🕊 PEACE RESTORED', 'The dragon retreats beyond the misty peaks.');
    this.villagers.forEach((v) => {
      if (v.role === 'Guard') {
        v.xp += 60;
        v.mood = 'Victorious';
      }
      v.react();
    });
    this.syncEvents();
  }

  public restorePeace(): void {
    this.endRaid();
    this.endFestival(true);
  }

  public syncEvents(): void {
    $('evFestival').classList.toggle('on', world.festival);
    $('evFestival').textContent = world.festival ? '🎉 End Festival' : '🎉 Harvest Festival';
    $('evRaid').classList.toggle('on', world.raid);
    $('evRaid').textContent = world.raid ? '🐉 Dragon Raid — in progress!' : '🐉 Dragon Raid';
  }

  public select(v: Villager | null): void {
    this.selected = v;
    $('inspector').classList.toggle('off', !v);
    if (!v) {
      this.follow = false;
      this.syncFollow();
    }
    ($('inspector') as HTMLElement & { inert: boolean }).inert = !v;
    this.invKey = this.statKey = '';
    if (v) {
      this.renderInspector();
      this.audio.blip();
    }
  }

  public setFollow(followSelected: boolean, followHeroVal: boolean): void {
    this.follow = followSelected;
    this.followHero = followHeroVal;
    this.syncFollow();
  }

  public focusHero = (): void => {
    this.followHero = true;
    this.follow = false;
    this.syncFollow();
  };

  public syncFollow(): void {
    $('followBtn').classList.toggle('on', this.follow);
    $('followBtn').textContent = this.follow ? '📍 Following — click to release' : '📍 Follow with camera';
  }

  private setBar(id: string, f: number, txt: string): void {
    const b = $(id);
    (b.firstElementChild as HTMLElement).style.width = `${clamp(f, 0, 1) * 100}%`;
    b.lastElementChild!.textContent = txt;
  }

  private renderInspector(): void {
    const v = this.selected;
    if (!v) return;
    $('iName').textContent = v.name;
    $('iClass').textContent = `${v.cls} · Level ${v.level}`;
    this.setBar('iHp', v.hp / v.hpMax, `HP ${Math.ceil(v.hp)} / ${v.hpMax}`);
    this.setBar('iSta', v.stamina / 100, `STAMINA ${Math.round(v.stamina)}`);
    this.setBar('iXp', v.xp / (v.level * 100), `XP ${Math.round(v.xp)} / ${v.level * 100}`);
    const sk = JSON.stringify(v.stats);
    if (sk !== this.statKey) {
      this.statKey = sk;
      $('iStats').replaceChildren(
        ...Object.entries(v.stats).map(([k, n]) => {
          const cell = document.createElement('div');
          const label = document.createElement('span');
          label.textContent = k;
          const val = document.createElement('b');
          val.textContent = String(n);
          cell.append(label, val);
          return cell;
        })
      );
    }
    $('iMood').textContent = v.mood;
    $('iAct').textContent = v.activity;
    $('iGold').textContent = `🪙 ${v.gold} gold`;
    const ik = v.inv.map((i) => i.name + i.qty).join('|');
    if (ik !== this.invKey) {
      this.invKey = ik;
      $('iInv').replaceChildren(
        ...v.inv.map((i) => {
          const li = document.createElement('li');
          li.title = i.name;
          const icon = document.createElement('span');
          icon.textContent = i.icon;
          const qty = document.createElement('em');
          qty.textContent = i.qty > 1 ? `×${i.qty}` : '';
          li.append(icon, i.name, qty);
          return li;
        })
      );
    }
    this.pctx.clearRect(0, 0, 16, 24);
    this.pctx.drawImage(v.sheet, v.frame * 16, 0, 16, 24, 0, 0, 16, 24);
  }

  private bindFishing(): void {
    $('closeFishing').addEventListener('click', () => this.closeFishing());
    this.autoFish.addEventListener('change', () => {
      if (!this.fishingRound) return;
      this.fishingRound.auto = this.autoFish.checked;
      this.fishingTap.disabled = this.fishingRound.auto;
    });
    this.fishingTap.addEventListener('click', () => this.fishingRound?.tap());
    this.fishingBar.style.height = `${CATCH_BAR_HEIGHT * 100}%`;
  }

  private castLine(target: THREE.Vector3): void {
    if (!this.hero.canFish()) {
      this.toast('Stand still at the water’s edge to cast.');
      return;
    }
    if (Math.hypot(target.x - this.hero.x, target.z - this.hero.z) > 5) {
      this.toast('Aim at water closer to the shore.');
      return;
    }
    this.clearPlayerMovement();
    this.hero.path = [];
    this.hero.cancelInteraction();
    this.select(null);
    this.focusHero();
    this.catchTime = 0;
    const direction = (target.x - this.hero.x) * this.engine.camRight.x +
      (target.z - this.hero.z) * this.engine.camRight.z;
    if (Math.abs(direction) > 0.2) this.hero.face = direction > 0 ? 1 : -1;
    $('caughtFish').hidden = true;
    this.throwBait(new V3(target.x, WATER_Y, target.z));
    this.setFishingControls(true);
    $('closeFishing').focus({ preventScroll: true });
  }

  private throwBait(target: THREE.Vector3): void {
    this.cast = {
      target,
      elapsed: 0,
      biteAt: CAST_FLIGHT + 0.9 + Math.random() * 1.7,
    };
  }

  private setFishingControls(active: boolean): void {
    this.movePad.inert = $('toolBar').inert = active;
    $('closeFishing').hidden = !active;
    $('playerCamera').hidden = active;
  }

  private closeFishing(): void {
    this.cast = this.fishingRound = null;
    this.recastIn = this.catchTime = 0;
    this.fishingPanel.hidden = $('caughtFish').hidden = true;
    this.setFishingControls(false);
    this.autoFish.focus({ preventScroll: true });
  }

  private showCatch(index: number): void {
    const fish = FISH[index];
    const [min, max] = fish.weight;
    const weight = lerp(min, max, Math.random());
    this.hero.fishCatches[index]++;
    this.catchTime = 0.001;
    this.catchColor = fish.color;
    const image = $('caughtFishImage') as HTMLImageElement;
    image.src = itemIcon('fish').toDataURL();
    $('caughtFishName').textContent = fish.name;
    $('caughtFishDetails').textContent = `${fish.rarity} · ${weight.toFixed(2)} kg`;
    $('caughtFish').hidden = false;
  }

  private updateFishing(dt: number): void {
    $('fishingMode').hidden = !this.hero.rodEquipped;
    if (this.catchTime > 0) {
      this.catchTime += dt;
      if (this.catchTime >= 3.4 || this.hero.step || !this.hero.rodEquipped) {
        this.catchTime = 0;
        $('caughtFish').hidden = true;
      }
    }

    const cast = this.cast;
    if (cast && this.recastIn > 0) {
      this.recastIn = Math.max(0, this.recastIn - dt);
      if (this.recastIn === 0) this.throwBait(cast.target);
    } else if (cast) {
      const previous = cast.elapsed;
      cast.elapsed += dt;
      if (previous < cast.biteAt && cast.elapsed >= cast.biteAt) this.audio.blip();
      if (!this.fishingRound && cast.elapsed >= cast.biteAt + BITE_ANIMATION) {
        this.fishingRound = new FishingRound(this.autoFish.checked);
        this.fishingFish.style.backgroundColor = FISH[this.fishingRound.fish].color;
        this.fishingTap.disabled = this.fishingRound.auto;
        this.fishingPanel.hidden = false;
        if (!this.fishingRound.auto && document.activeElement === $('closeFishing')) {
          this.fishingTap.focus({ preventScroll: true });
        }
      }
    }
    const round = this.fishingRound;
    if (round) {
      round.update(dt);
      this.fishingBar.style.bottom = `${(round.bar - CATCH_BAR_HEIGHT / 2) * 100}%`;
      this.fishingFish.style.bottom = `${round.position * 100}%`;
      this.fishingProgress.value = round.progress;
      if (round.result) {
        if (document.activeElement === this.fishingTap) $('closeFishing').focus({ preventScroll: true });
        this.fishingRound = null;
        this.fishingPanel.hidden = true;
        this.recastIn = round.result === 'caught' ? 3.4 : 0.8;
        if (round.result === 'caught') this.showCatch(round.fish);
        else this.toast('The fish escaped.');
      }
    }
    const visibleCast = this.recastIn > 0 ? null : this.cast;
    this.hero.fishingPose = visibleCast ? 'cast' : this.catchTime > 0.18 ? 'hold' : null;
    this.hero.fishingElapsed = visibleCast?.elapsed ?? 0;
    this.hero.fishingReeling = this.fishingRound !== null;
    if (visibleCast) this.hero.faceToward(visibleCast.target.x, visibleCast.target.z);
    this.fishingVisuals.update(
      this.hero.mesh.position, this.engine.camRight, this.hero.face, this.hero.rodEquipped,
      visibleCast, this.catchTime, this.catchColor, this.hero.getFishingHand(), this.hero.equipmentAim,
      this.hero.equipment.appearance.rod,
    );
  }

  private bindInventory(): void {
    const bagButton = $('openBag');
    bagButton.querySelector('.bagIcon')!.replaceWith(itemIcon('bag'));
    bagButton.addEventListener('click', () => {
      if (this.bag.open) return;
      this.clearPlayerMovement();
      this.bag.showModal();
      this.refreshInventory();
    });
    for (const category of ['Equipment', 'Items']) {
      $(`show${category}`).addEventListener('click', () => {
        for (const option of ['Equipment', 'Items']) {
          $(`bag${option}`).hidden = option !== category;
          $(`show${option}`).setAttribute('aria-pressed', String(option === category));
        }
      });
    }
    this.hotbar.forEach((_, index) => {
      const slot = document.createElement('div');
      slot.className = 'itemSlot';
      const key = document.createElement('kbd');
      key.textContent = String(index + 1);
      key.setAttribute('aria-hidden', 'true');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'slotAction';
      button.setAttribute('aria-keyshortcuts', String(index + 1));
      button.addEventListener('click', () => {
        const entry = this.hotbar[index];
        entry?.equip(!entry.active());
        this.refreshInventory();
      });
      slot.append(key, button);
      this.slotButtons.push(button);
      bagButton.before(slot);
    });

    for (const entry of this.bagEntries) {
      const { row, count } = this.bagRow(entry.id, entry.name);
      this.bagCounts.set(entry, count);
      const selector = document.createElement('select');
      selector.setAttribute('aria-label', `Hotbar slot for ${entry.name}`);
      selector.add(new Option('In bag', '-1'));
      this.hotbar.forEach((_, index) => selector.add(new Option(`Slot ${index + 1}`, String(index))));
      selector.addEventListener('change', () => {
        const old = this.hotbar.indexOf(entry);
        const next = Number(selector.value);
        if (old === next) return;
        if (old >= 0) this.hotbar[old] = null;
        if (next >= 0) {
          const displaced = this.hotbar[next];
          if (displaced?.active()) displaced.equip(false);
          this.hotbar[next] = entry;
        } else if (entry.active()) {
          entry.equip(false);
        }
        this.refreshInventory();
      });
      row.append(selector);
      this.slotSelectors.set(entry, selector);
      $(entry.count ? 'bagItems' : 'bagEquipment').append(row);
    }
    FISH.forEach(({ name, rarity }, index) => {
      const { row, count } = this.bagRow('fish', name);
      row.title = rarity;
      row.id = `bagFish${index}`;
      count.className = 'bagFishCount';
      $('bagItems').append(row);
    });
    this.refreshInventory();
  }

  private bagRow(icon: ItemIcon, name: string): { row: HTMLElement; count: HTMLElement } {
    const row = document.createElement('div');
    row.className = 'bagRow';
    const label = document.createElement('span');
    label.textContent = name;
    const count = document.createElement('span');
    row.append(itemIcon(icon), label, count);
    return { row, count };
  }

  private refreshInventory(): void {
    this.slotButtons.forEach((button, index) => {
      const entry = this.hotbar[index];
      const count = entry?.count?.();
      if (button.dataset.item !== (entry?.id ?? '')) {
        button.replaceChildren();
        if (entry) {
          button.append(itemIcon(entry.id));
          if (entry.count) {
            const badge = document.createElement('span');
            badge.className = 'itemCount';
            button.append(badge);
          }
        }
        button.dataset.item = entry?.id ?? '';
      }
      const badge = button.querySelector('.itemCount');
      if (badge) badge.textContent = String(count);
      button.parentElement!.classList.toggle('emptySlot', !entry);
      button.disabled = !entry || count === 0;
      button.setAttribute('aria-pressed', String(entry?.active() ?? false));
      const label = entry ? entry.name + (count === undefined ? '' : `, ${count}`) : 'Empty slot';
      button.setAttribute('aria-label', label);
      button.title = label;
    });
    if (!this.bag.open) return;
    for (const [entry, selector] of this.slotSelectors) {
      selector.value = String(this.hotbar.indexOf(entry));
      this.bagCounts.get(entry)!.textContent = entry.count ? `×${entry.count()}` : '';
    }
    this.hero.fishCatches.forEach((count, index) => {
      const row = $(`bagFish${index}`);
      row.hidden = count === 0;
      row.querySelector('.bagFishCount')!.textContent = `×${count}`;
    });
  }

  public refreshBuildStatus(): void {
    this.refreshInventory();
    const throwButton = $('throwItem') as HTMLButtonElement;
    throwButton.classList.toggle('hide', !this.hero.carrying);
    throwButton.disabled = !this.hero.throwLimit;
    $('buildStatus').classList.toggle('hide', !this.hero.buildingSite);
    if (!this.hero.buildingSite) return;
    const { stored } = this.hero.buildingSite;
    $('buildProgress').textContent = `House · ${stored}/${HOUSE_WOOD_COST} wood · ${Math.round((stored / HOUSE_WOOD_COST) * 100)}%`;
    ($('depositWood') as HTMLButtonElement).disabled = !this.hero.deliveryLimit;
  }

  private askQuantity(action: 'throw' | 'deposit'): void {
    const limit = action === 'throw' ? this.hero.throwLimit : this.hero.deliveryLimit;
    if (!limit) {
      if (action === 'deposit' && this.hero.carrying !== 'wood') this.toast('Select Wood in the hotbar first.');
      return;
    }
    const item = this.hero.carrying === 'meat' ? 'venison' : 'wood';
    const verb = action === 'throw' ? 'Throw' : 'Deposit';
    const input = $('quantityAmount') as HTMLInputElement;
    this.quantityAction = action;
    $('quantityLabel').textContent = `${verb} ${item} (1–${limit})`;
    $('quantityConfirm').textContent = verb;
    input.max = String(limit);
    input.value = '1';
    this.clearPlayerMovement();
    this.hero.cancelInteraction();
    this.hero.path = [];
    this.quantityDialog.showModal();
    input.select();
  }

  private showChopProgress(hits: number | null): void {
    const progress = $('chopProgress');
    progress.classList.toggle('hide', hits === null);
    if (hits !== null) {
      const percent = Math.round((hits / STRIKES_TO_FELL) * 100);
      progress.textContent = `Chopping · ${percent}%`;
    }
  }

  public setChatOpen(open: boolean): void {
    this.chatPanel.classList.toggle('hide', !open);
    $('chatToggle').setAttribute('aria-expanded', String(open));
    if (open) this.chatInput.focus();
  }

  private bindUI(): void {
    $('time').addEventListener('input', (e) => (world.time = +(e.target as HTMLInputElement).value));
    $('weather').addEventListener('input', (e) => (world.weather = +(e.target as HTMLInputElement).value));
    $('flow').addEventListener('change', (e) => (world.flow = (e.target as HTMLInputElement).checked));
    $('tilt').addEventListener('input', (e) => (world.tilt = +(e.target as HTMLInputElement).value));
    $('focus').addEventListener('input', (e) => (world.focus = +(e.target as HTMLInputElement).value));
    $('orbit').addEventListener('change', (e) => (world.autoOrbit = (e.target as HTMLInputElement).checked));
    $('ffToggle').addEventListener('change', (e) => (world.fireflies = (e.target as HTMLInputElement).checked));
    document.querySelectorAll<HTMLElement>('[data-preset]').forEach((b) =>
      b.addEventListener('click', () => {
        this.audio.resume();
        this.audio.blip();
        this.applyPreset(b.dataset.preset!);
      })
    );
    $('evFestival').addEventListener('click', () => {
      this.audio.resume();
      world.festival ? this.endFestival() : this.startFestival();
    });
    $('evRaid').addEventListener('click', () => {
      this.audio.resume();
      world.raid ? this.endRaid() : this.startRaid();
    });
    $('evPeace').addEventListener('click', () => {
      this.audio.resume();
      this.restorePeace();
    });
    $('musicBtn').addEventListener('click', () => {
      const fresh = !this.audio.ctx;
      this.audio.resume();
      if (!fresh) this.audio.setOn(!this.audio.on);
    });
    $('vol').addEventListener('input', (e) => this.audio.setVol(+(e.target as HTMLInputElement).value));
    $('deckToggle').addEventListener('click', () => {
      const deck = $('deck') as HTMLElement & { inert: boolean };
      const collapsed = deck.classList.toggle('collapsed');
      deck.inert = collapsed;
      $('deckToggle').setAttribute('aria-expanded', String(!collapsed));
    });
    $('inspClose').addEventListener('click', () => this.select(null));
    $('followBtn').addEventListener('click', () => {
      this.follow = !this.follow;
      this.followHero = !this.follow;
      this.syncFollow();
    });

    $('depositWood').addEventListener('click', () => this.askQuantity('deposit'));
    $('throwItem').addEventListener('click', () => this.askQuantity('throw'));
    $('quantityForm').addEventListener('submit', (event) => {
      if ((event as SubmitEvent).submitter?.getAttribute('formmethod') === 'dialog') return;
      event.preventDefault();
      const amount = ($('quantityAmount') as HTMLInputElement).valueAsNumber;
      const throwing = this.quantityAction === 'throw';
      const limit = throwing ? this.hero.throwLimit : this.hero.deliveryLimit;
      this.quantityDialog.close();
      if (!Number.isInteger(amount) || amount < 1 || amount > limit) {
        this.toast('The available quantity changed. Choose a new amount.');
      } else if (throwing) {
        this.hero.throwCarriedItem(amount, this.engine.camRight);
      } else {
        this.hero.beginDelivery(amount);
      }
    });
    $('playerCamera').addEventListener('click', () => {
      this.focusHero();
      this.engine.goal.dist = 23;
    });

    this.bindMoveStick();

    $('chatToggle').addEventListener('click', () => this.setChatOpen(this.chatPanel.classList.contains('hide')));
    this.chatInput.addEventListener('focus', () => this.clearPlayerMovement());
    $('chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const message = this.chatInput.value.trim();
      if (!message) return;

      if (message.startsWith('/name ')) {
        const nextName = message.slice(6).trim().slice(0, 20);
        if (nextName) {
          this.hero.name = nextName;
          if (this.multiplayer.isConnected) this.multiplayer.sendName(nextName);
          this.appendChatMessage('System', `You are now known as ${nextName}.`, true);
        }
        this.chatInput.value = '';
        this.chatInput.focus();
        return;
      }

      if (this.multiplayer.isConnected) {
        this.multiplayer.sendChat(message);
      } else {
        this.appendChatMessage(this.hero.name, message);
      }
      this.showHeroSpeech(message);
      this.chatInput.value = '';
      this.chatInput.focus();
    });
  }

  private bindMoveStick(): void {
    const update = (event: PointerEvent) => {
      if (event.pointerId !== this.stickPointer) return;
      const bounds = this.movePad.getBoundingClientRect();
      const x = event.clientX - (bounds.left + bounds.width / 2);
      const y = event.clientY - (bounds.top + bounds.height / 2);
      const radius = Math.hypot(x, y);
      const travel = (bounds.width - this.moveThumb.offsetWidth) / 2;
      const scale = radius > travel ? travel / radius : 1;
      this.moveThumb.style.transform = `translate(${x * scale}px, ${y * scale}px)`;

      if (radius < travel * 0.25) {
        this.hero.heldMoves.delete('moveStick');
        return;
      }
      const sector = Math.round(Math.atan2(y, x) / (Math.PI / 4));
      const direction = STICK_DIRECTIONS[(sector + STICK_DIRECTIONS.length) % STICK_DIRECTIONS.length];
      if (!this.hero.heldMoves.has('moveStick')) {
        this.hero.cancelInteraction();
        this.hero.path = [];
        this.focusHero();
      }
      this.hero.heldMoves.set('moveStick', direction);
    };

    this.movePad.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || this.stickPointer !== null) return;
      event.preventDefault();
      this.audio.resume();
      this.movePad.setPointerCapture(event.pointerId);
      this.stickPointer = event.pointerId;
      update(event);
    });
    this.movePad.addEventListener('pointermove', update);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.movePad.addEventListener(type, (event) => {
        if ((event as PointerEvent).pointerId === this.stickPointer) this.resetMoveStick();
      });
    }
    this.movePad.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('resize', () => this.resetMoveStick());
  }

  private resetMoveStick(): void {
    const pointer = this.stickPointer;
    if (pointer === null) return;
    this.stickPointer = null;
    this.hero.heldMoves.delete('moveStick');
    this.moveThumb.style.transform = '';
    if (this.movePad.hasPointerCapture(pointer)) this.movePad.releasePointerCapture(pointer);
  }

  private clearPlayerMovement(): void {
    this.resetMoveStick();
    this.hero.clearMovement();
  }

  private bindPointerEvents(): void {
    const canvas = this.engine.canvas;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      this.audio.resume();
      if (this.cast) {
        if (e.button === 0) this.fishingRound?.tap();
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
      }
      this.dragMode = e.button === 2 || e.shiftKey ? 'pan' : 'orbit';
      this.downPos = this.pointers.size === 1 && e.button === 0 && !e.shiftKey ? { x: e.clientX, y: e.clientY } : null;
      canvas.classList.add('drag');
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) {
        this.hoverPick(e);
        return;
      }
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.downPos && Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y) < 6) return;
      this.downPos = null;
      this.engine.lastInput = world.T;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch0) this.engine.goal.dist = clamp((this.engine.goal.dist * this.pinch0) / d, 16, 120);
        this.pinch0 = d;
        return;
      }
      if (this.dragMode === 'orbit') {
        this.engine.goal.yaw -= dx * 0.006;
        this.engine.goal.pitch = clamp(this.engine.goal.pitch + dy * 0.004, 0.28, 1.35);
      } else {
        const s = this.engine.goal.dist * 0.0016;
        const f = new V3(-Math.sin(this.engine.goal.yaw), 0, -Math.cos(this.engine.goal.yaw));
        const r = new V3(Math.cos(this.engine.goal.yaw), 0, -Math.sin(this.engine.goal.yaw));
        this.engine.goal.target.addScaledVector(r, -dx * s).addScaledVector(f, dy * s);
        this.engine.goal.target.x = clamp(this.engine.goal.target.x, -ORIGIN, N - ORIGIN);
        this.engine.goal.target.z = clamp(this.engine.goal.target.z, -ORIGIN, N - ORIGIN);
        this.follow = this.followHero = false;
        this.syncFollow();
      }
    });

    const endPtr = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      canvas.classList.remove('drag');
      if (this.pointers.size < 2) this.pinch0 = 0;
      const clickStart = this.downPos;
      this.downPos = null;
      if (
        clickStart &&
        Math.hypot(e.clientX - clickStart.x, e.clientY - clickStart.y) < 6 &&
        e.type === 'pointerup' &&
        e.button === 0
      ) {
        const villager = this.pickAt(e.clientX, e.clientY);
        const point = this.pickMapPoint();
        const tile: [number, number] | null = point ? [ti(point.x), tj(point.z)] : null;
        if (this.hero.rodEquipped && point && tile && this.isFishingWater(...tile)) {
          this.castLine(point);
          return;
        }
        const meat = this.pickMeat();
        if (this.hero.bowEquipped) {
          this.select(null);
          const deerHit = this.pickDeer();
          if (meat && (!deerHit || meat.distance < deerHit.hit.distance)) {
            const drop = meat.object.parent?.userData.drop;
            if (drop) this.hero.startInteraction('loot', drop, drop.i, drop.j);
          } else if (deerHit) {
            const d = this.wildlife.deer[deerHit.deerIndex];
            this.hero.shootArrowAt(() => new V3(d.pos.x, d.pos.y + 0.72, d.pos.z), this.engine.camRight);
          } else {
            const pt = this.pickMapPoint();
            if (pt) {
              const target = new V3(pt.x, this.grid.groundY(pt.x, pt.z) - 0.01, pt.z);
              this.hero.shootArrowAt(() => target, this.engine.camRight);
            } else this.toast('Aim at a deer or anywhere on the map to shoot.', 1500);
          }
          return;
        }
        if (this.hero.placingBlueprint) {
          if (tile) this.hero.placeBlueprint(...tile);
          else this.toast('Choose a tile on the map for the blueprint.');
          return;
        }
        if (tile && this.hero.isBlueprintTile(...tile)) {
          this.select(null);
          this.askQuantity('deposit');
          return;
        }
        const tree = this.pickTree();
        const wood = this.pickWood();
        const closestDrop =
          meat && (!wood || meat.distance < wood.distance) ? meat : wood;
        if (closestDrop && (!tree || closestDrop.distance < tree.distance)) {
          this.select(null);
          const drop = closestDrop.object.parent?.userData.drop;
          if (drop) this.hero.startInteraction('loot', drop, drop.i, drop.j);
        } else if (tree && tree.instanceId !== undefined) {
          this.select(null);
          if (!this.hero.axeEquipped) this.toast('Equip the axe to chop a tree.');
          else {
            const { i, j } = this.vegetation.trees[tree.instanceId];
            this.hero.startInteraction('chop', tree.instanceId, i, j);
          }
        } else if (villager) {
          this.select(villager);
        } else {
          this.select(null);
          if (tile) this.hero.walkToMapTile(...tile);
        }
      }
    };

    canvas.addEventListener('pointerup', endPtr);
    canvas.addEventListener('pointercancel', endPtr);
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.engine.lastInput = world.T;
        this.engine.goal.dist = clamp(this.engine.goal.dist * Math.exp(e.deltaY * 0.0012), 16, 120);
      },
      { passive: false }
    );
    window.addEventListener('pointerdown', () => this.audio.resume(), { once: true });
  }

  private bindKeyboardEvents(): void {
    window.addEventListener('keyup', (e) => this.hero.heldMoves.delete(e.code));
    window.addEventListener('blur', () => this.clearPlayerMovement());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearPlayerMovement();
    });
    window.addEventListener('keydown', (e) => {
      if (this.bag.open || this.quantityDialog.open) return;
      if (this.cast) {
        const target = e.target as HTMLElement | null;
        if (e.code === 'Space' && this.fishingRound &&
            !target?.matches('input, textarea, select, button') && !target?.isContentEditable) {
          e.preventDefault();
          if (!e.repeat) this.fishingRound.tap();
        }
        return;
      }
      if (e.key === 'Escape' && !this.chatPanel.classList.contains('hide')) {
        this.setChatOpen(false);
        $('chatToggle').focus();
        return;
      }
      if (e.key === 'Enter' && !e.repeat && e.target === document.body) {
        e.preventDefault();
        this.setChatOpen(true);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range' && (target as HTMLInputElement).type !== 'checkbox') {
        return;
      }
      if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey &&
          !target?.isContentEditable && !target?.matches('input, textarea, select')) {
        if (e.code === 'KeyB') {
          e.preventDefault();
          $('openBag').click();
          return;
        }
        const slot = this.slotButtons[Number(e.key) - 1];
        if (slot) {
          slot.click();
          return;
        }
      }
      const direction = MOVE_KEYS.get(e.code);
      if (
        direction &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !target?.isContentEditable &&
        !target?.matches?.('input, textarea, select')
      ) {
        e.preventDefault();
        if (!e.repeat) {
          this.hero.cancelInteraction();
          this.hero.path = [];
          this.hero.heldMoves.set(e.code, direction);
          this.hero.queuedMove = direction;
          this.focusHero();
        }
        return;
      }
      this.audio.resume();
      if (e.key === 'Escape') {
        this.hero.setRodMode(false);
        this.hero.setBlueprintMode(false);
        this.hero.setBowMode(false);
        this.hero.setCarryItem(null);
        this.select(null);
      }
    });
  }

  private pickAt(cx: number, cy: number): Villager | null {
    this.ndc.set((cx / window.innerWidth) * 2 - 1, (-cy / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.engine.camera);
    const hit = this.ray.intersectObjects(
      this.villagers.filter((v) => !v.hidden).map((v) => v.mesh),
      false
    )[0];
    return hit ? (hit.object.userData.v as Villager) : null;
  }

  private pickTree(): THREE.Intersection | undefined {
    return this.ray
      .intersectObjects(this.vegetation.treeMeshes, false)
      .find((hit) => hit.instanceId !== undefined && !this.vegetation.trees[hit.instanceId].chopped);
  }

  private pickWood(): THREE.Intersection | undefined {
    return this.ray.intersectObjects(
      this.hero.woodDrops.map((drop) => drop.mesh),
      true
    )[0];
  }

  private pickMeat(): THREE.Intersection | undefined {
    return this.ray.intersectObjects(
      this.hero.meatDrops.map((drop) => drop.mesh),
      true
    )[0];
  }

  private pickDeer(): { hit: THREE.Intersection; deerIndex: number } | undefined {
    const aliveMeshes = this.wildlife.deer.filter((d) => d.alive).map((d) => d.mesh);
    const hit = this.ray.intersectObjects(aliveMeshes, true)[0];
    if (!hit) return undefined;
    const deerIndex = hit.object.userData.deerIndex;
    return typeof deerIndex === 'number' ? { hit, deerIndex } : undefined;
  }

  private pickMapPoint(): THREE.Vector3 | null {
    const hit = this.ray.intersectObjects(this.mapSurfaces, false).find((c) => c.face && c.face.normal.y > 0.5);
    return hit ? hit.point : null;
  }

  private pickMapTile(): [number, number] | null {
    const pt = this.pickMapPoint();
    return pt ? [ti(pt.x), tj(pt.z)] : null;
  }

  private isFishingWater(i: number, j: number): boolean {
    return inGrid(i, j) && this.grid.TYPE[idx(i, j)] === T.RIVER;
  }

  private hoverPick(e: PointerEvent): void {
    const n = performance.now();
    if (n - this.hoverT < 90) return;
    this.hoverT = n;
    const villager = this.pickAt(e.clientX, e.clientY);
    const tile = this.hero.buildingSite || this.hero.rodEquipped ? this.pickMapTile() : null;
    this.engine.canvas.style.cursor =
      this.hero.placingBlueprint || this.hero.bowEquipped ||
      (this.hero.canFish() && tile && this.isFishingWater(...tile))
        ? 'crosshair'
        : villager ||
            (tile && this.hero.isBlueprintTile(...tile)) ||
            this.pickWood() ||
            this.pickMeat() ||
            (this.hero.axeEquipped && this.pickTree())
          ? 'pointer'
          : '';
  }

  private updateNameLabel(label: HTMLElement, actorMesh: THREE.Object3D, height: number, visible: boolean): void {
    if (visible) {
      this.labelPoint.copy(actorMesh.position);
      this.labelPoint.y += height;
      this.labelPoint.project(this.engine.camera);
      const { x, y, z } = this.labelPoint;
      visible = z >= -1 && z <= 1 && Math.abs(x) <= 1 && Math.abs(y) <= 1;
      if (visible) {
        label.style.transform = `translate(${((x + 1) * window.innerWidth) / 2}px, ${((1 - y) * window.innerHeight) / 2}px)`;
      }
    }
    label.classList.toggle('hide', !visible);
  }

  public updateNameLabels(now: number): void {
    if (!this.fishingPanel.hidden) {
      this.labelPoint.copy(this.hero.mesh.position);
      this.labelPoint.y += 1;
      this.labelPoint.project(this.engine.camera);
      const x = (this.labelPoint.x + 1) * window.innerWidth / 2;
      const y = (1 - this.labelPoint.y) * window.innerHeight / 2;
      const { offsetWidth: width, offsetHeight: height } = this.fishingPanel;
      const left = x - width - 38;
      this.fishingPanel.style.left = `${clamp(left >= 8 ? left : x + 38, 8, window.innerWidth - width - 8)}px`;
      this.fishingPanel.style.top = `${clamp(y - height / 2, 8, window.innerHeight - height - 8)}px`;
    }
    const caught = $('caughtFish');
    if (!caught.hidden) {
      this.labelPoint.copy(this.hero.mesh.position);
      this.labelPoint.y += 2.6;
      this.labelPoint.project(this.engine.camera);
      const x = (this.labelPoint.x + 1) * window.innerWidth / 2;
      const y = (1 - this.labelPoint.y) * window.innerHeight / 2;
      const half = caught.offsetWidth / 2;
      caught.style.left = `${clamp(x, half + 8, window.innerWidth - half - 8)}px`;
      caught.style.top = `${Math.max(caught.offsetHeight + 10, y)}px`;
    }
    this.heroNameLabel.firstElementChild!.textContent = this.hero.name;
    this.updateNameLabel(this.heroNameLabel, this.hero.mesh, 2.12, true);
    this.speechBubble.classList.toggle('hide', now >= this.bubbleUntil);

    for (const peer of this.multiplayer.peers.values()) {
      this.updateNameLabel(peer.labelEl, peer.mesh, 2.12, true);
      peer.updateBubbleVisibility(now);
    }

    this.villagers.forEach((v, i) =>
      this.updateNameLabel(
        this.npcNameLabels[i],
        v.mesh,
        1.5 * v.sc + 0.24,
        !v.hidden && Math.hypot(v.x - this.hero.x, v.z - this.hero.z) <= this.npcNameRange
      )
    );
  }

  public updateUI(dt: number): void {
    this.updateFishing(dt);
    if ((this.uiT += dt) < 0.1) return;
    this.uiT = 0;
    this.refreshInventory();
    const tEl = $('time') as HTMLInputElement;
    const wEl = $('weather') as HTMLInputElement;
    if (document.activeElement !== tEl) tEl.value = world.time.toFixed(2);
    if (document.activeElement !== wEl) wEl.value = world.weather.toFixed(3);
    $('timeOut').textContent = fmtTime(world.time);
    $('phase').textContent = phaseName(world.time);
    $('weatherOut').textContent = weatherName(world.weather).replace('Heavy ', '');
    if (this.selected) this.renderInspector();
  }
}
