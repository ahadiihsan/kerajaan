import * as THREE from 'three';
import { clamp, lerp, pick, R, V3 } from '../utils/math';
import { fmtTime, overlay, phaseName, PRESETS, weatherName, world } from '../core/WorldState';
import { N, ORIGIN, PCW, ti, tj, WorldGrid } from '../world/WorldGrid';
import type { ProceduralTextures } from '../world/Textures';
import type { WorldBuildings } from '../world/Buildings';
import type { WorldVegetation } from '../world/Vegetation';
import type { Pool } from '../core/Particles';
import type { AudioEngine } from '../core/AudioEngine';
import type { Engine } from '../core/Engine';
import type { Dragon } from '../entities/Dragon';
import { HOUSE_WOOD_COST, MOVE_KEYS, STRIKES_TO_FELL, type HeroController } from '../entities/HeroController';
import type { Villager } from '../entities/Villager';
import type { MultiplayerManager } from '../multiplayer/MultiplayerManager';

const $ = (id: string) => document.getElementById(id)!;

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
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly labelPoint = new V3();
  private readonly npcNameRange = 5;

  private readonly pctx: CanvasRenderingContext2D;
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
  private readonly mapSurfaces: THREE.Mesh[];
  private readonly fxNorm: Pool;
  private readonly audio: AudioEngine;
  private readonly dragon: Dragon;
  private readonly villagers: Villager[];
  private readonly hero: HeroController;
  private readonly multiplayer: MultiplayerManager;
  private onStartAutoDemo?: () => void;
  private isDemoActive: () => boolean = () => false;

  constructor(opts: {
    engine: Engine;
    grid: WorldGrid;
    buildings: WorldBuildings;
    vegetation: WorldVegetation;
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
    this.grid = opts.grid;
    this.buildings = opts.buildings;
    this.vegetation = opts.vegetation;
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

    this.hero.onBuildStatusChange = () => this.refreshBuildStatus();
    this.hero.onChopProgressChange = (hits) => this.showChopProgress(hits);
    this.hero.onBlueprintModeChange = (active) => {
      const btn = $('blueprintTool');
      btn.classList.toggle('on', active);
      btn.setAttribute('aria-pressed', String(active));
    };

    this.bindUI();
    this.bindPointerEvents();
    this.bindKeyboardEvents();
    this.syncEvents();
    this.syncFollow();
    this.refreshBuildStatus();
  }

  public bindAutoDemo(startFn: () => void, isActiveFn: () => boolean): void {
    this.onStartAutoDemo = startFn;
    this.isDemoActive = isActiveFn;
    $('demoBtn').addEventListener('click', startFn);
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
    overlay.banner = { title, sub, style, t0: performance.now(), until: performance.now() + dur };
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

  public refreshBuildStatus(): void {
    $('woodCount').textContent = `Wood ${this.hero.wood}`;
    $('buildStatus').classList.toggle('hide', !this.hero.buildingSite);
    if (!this.hero.buildingSite) return;
    const { stored } = this.hero.buildingSite;
    $('buildProgress').textContent = `House · ${stored}/${HOUSE_WOOD_COST} wood · ${Math.round((stored / HOUSE_WOOD_COST) * 100)}%`;
    ($('depositWood') as HTMLButtonElement).disabled = this.hero.wood === 0;
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

    $('axeTool').addEventListener('click', (e) => {
      this.hero.axeEquipped = !this.hero.axeEquipped;
      const btn = e.currentTarget as HTMLElement;
      btn.setAttribute('aria-pressed', String(this.hero.axeEquipped));
      btn.classList.toggle('on', this.hero.axeEquipped);
      if (this.hero.axeEquipped) this.toast('Axe equipped. Click or tap a tree.', 2200);
      else if (this.hero.interaction?.kind === 'chop') this.hero.cancelInteraction();
    });

    $('blueprintTool').addEventListener('click', () => {
      if (this.hero.buildingSite) this.toast('Finish the current house before placing another blueprint.');
      else this.hero.setBlueprintMode(!this.hero.placingBlueprint);
    });
    $('depositWood').addEventListener('click', () => this.hero.beginDelivery());
    $('playerCamera').addEventListener('click', () => {
      this.focusHero();
      this.engine.goal.dist = 23;
    });

    document.querySelectorAll<HTMLElement>('[data-move]').forEach((button) => {
      button.addEventListener('click', () => {
        this.focusHero();
        this.hero.cancelInteraction();
        this.hero.path = [];
        this.hero.queuedMove = button.dataset.move as typeof this.hero.queuedMove;
      });
    });

    $('chatToggle').addEventListener('click', () => this.setChatOpen(this.chatPanel.classList.contains('hide')));
    this.chatInput.addEventListener('focus', () => this.hero.clearMovement());
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

  private bindPointerEvents(): void {
    const canvas = this.engine.canvas;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      this.audio.resume();
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
      if (this.isDemoActive()) return;
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
        e.button === 0 &&
        !this.isDemoActive()
      ) {
        const villager = this.pickAt(e.clientX, e.clientY);
        const tile = this.pickMapTile();
        if (this.hero.placingBlueprint) {
          if (tile) this.hero.placeBlueprint(...tile);
          else this.toast('Choose a tile on the map for the blueprint.');
          return;
        }
        if (tile && this.hero.isBlueprintTile(...tile)) {
          this.select(null);
          this.hero.beginDelivery();
          return;
        }
        const tree = this.pickTree();
        const wood = this.pickWood();
        if (wood && (!tree || wood.distance < tree.distance)) {
          this.select(null);
          const drop = wood.object.parent?.userData.drop;
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
        if (this.isDemoActive()) return;
        this.engine.lastInput = world.T;
        this.engine.goal.dist = clamp(this.engine.goal.dist * Math.exp(e.deltaY * 0.0012), 16, 120);
      },
      { passive: false }
    );
    window.addEventListener('pointerdown', () => this.audio.resume(), { once: true });
  }

  private bindKeyboardEvents(): void {
    window.addEventListener('keyup', (e) => this.hero.heldMoves.delete(e.code));
    window.addEventListener('blur', () => this.hero.clearMovement());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.hero.clearMovement();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.chatPanel.classList.contains('hide')) {
        this.setChatOpen(false);
        $('chatToggle').focus();
        return;
      }
      if (e.key === 'Enter' && !e.repeat && !this.isDemoActive() && e.target === document.body) {
        e.preventDefault();
        this.setChatOpen(true);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range' && (target as HTMLInputElement).type !== 'checkbox') {
        return;
      }
      const direction = MOVE_KEYS.get(e.code);
      if (
        direction &&
        !this.isDemoActive() &&
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
      if (e.key === 'r' || e.key === 'R') this.onStartAutoDemo?.();
      if (e.key === 'Escape') {
        this.hero.setBlueprintMode(false);
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

  private pickMapTile(): [number, number] | null {
    const hit = this.ray.intersectObjects(this.mapSurfaces, false).find((c) => c.face && c.face.normal.y > 0.5);
    return hit ? [ti(hit.point.x), tj(hit.point.z)] : null;
  }

  private hoverPick(e: PointerEvent): void {
    const n = performance.now();
    if (n - this.hoverT < 90) return;
    this.hoverT = n;
    const villager = this.pickAt(e.clientX, e.clientY);
    const tile = this.hero.buildingSite ? this.pickMapTile() : null;
    this.engine.canvas.style.cursor = this.hero.placingBlueprint
      ? 'crosshair'
      : villager || (tile && this.hero.isBlueprintTile(...tile)) || this.pickWood() || (this.hero.axeEquipped && this.pickTree())
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
    const demoActive = this.isDemoActive();
    this.heroNameLabel.firstElementChild!.textContent = this.hero.name;
    this.updateNameLabel(this.heroNameLabel, this.hero.mesh, 2.12, !demoActive);
    this.speechBubble.classList.toggle('hide', now >= this.bubbleUntil);

    for (const peer of this.multiplayer.peers.values()) {
      this.updateNameLabel(peer.labelEl, peer.mesh, 2.12, !demoActive);
      peer.updateBubbleVisibility(now);
    }

    this.villagers.forEach((v, i) =>
      this.updateNameLabel(
        this.npcNameLabels[i],
        v.mesh,
        1.5 * v.sc + 0.24,
        !demoActive && !v.hidden && Math.hypot(v.x - this.hero.x, v.z - this.hero.z) <= this.npcNameRange
      )
    );
  }

  public updateUI(dt: number): void {
    if ((this.uiT += dt) < 0.1) return;
    this.uiT = 0;
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
