import * as THREE from 'three';
import type { WorldCoopSnapshot } from '../../server/coopWorld';
import type { PlayerData } from '../../server/multiplayerServer';
import type { HeroController } from '../entities/HeroController';
import type { WorldVegetation } from '../world/Vegetation';
import type { WorldGrid } from '../world/WorldGrid';
import { RemoteTraveler } from './RemoteTraveler';

export interface MultiplayerCallbacks {
  onStatusChange?: (connected: boolean, playerCount: number) => void;
  onChatMessage?: (id: string, name: string, text: string) => void;
  onSystemMessage?: (text: string) => void;
  onToast?: (msg: string, ms?: number) => void;
}

export class MultiplayerManager {
  public localId: string | null = null;
  public isConnected = false;
  public readonly peers = new Map<string, RemoteTraveler>();

  private socket: WebSocket | null = null;
  private lastSendAt = 0;
  private readonly sendIntervalMs = 50;
  private reconnectTimer: number | null = null;

  private readonly scene: THREE.Scene;
  private readonly grid: WorldGrid;
  private readonly vegetation: WorldVegetation;
  private readonly labelsContainer: HTMLElement;
  private readonly callbacks: MultiplayerCallbacks;
  private hero!: HeroController;

  constructor(opts: {
    scene: THREE.Scene;
    grid: WorldGrid;
    vegetation: WorldVegetation;
    labelsContainer: HTMLElement;
    callbacks?: MultiplayerCallbacks;
  }) {
    this.scene = opts.scene;
    this.grid = opts.grid;
    this.vegetation = opts.vegetation;
    this.labelsContainer = opts.labelsContainer;
    this.callbacks = opts.callbacks ?? {};
  }

  public attachHero(hero: HeroController): void {
    this.hero = hero;
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    let wsUrl: string;
    const params = new URLSearchParams(window.location.search);
    const customServer = params.get('server');
    if (customServer) {
      try {
        const parsed = new URL(customServer, window.location.href);
        if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') return;
        wsUrl = parsed.toString();
      } catch {
        return;
      }
    } else if (import.meta.env.DEV) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws`;
    } else {
      wsUrl = 'wss://empire.ahadiihsan.com/ws';
    }

    try {
      this.socket = new WebSocket(wsUrl);
      this.socket.onopen = () => {
        this.isConnected = true;
        this.callbacks.onStatusChange?.(true, this.peers.size + 1);
      };
      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (err) {
          console.error('[Multiplayer] Failed to parse server message:', err);
        }
      };
      this.socket.onclose = () => {
        this.isConnected = false;
        this.clearPeers();
        this.callbacks.onStatusChange?.(false, 1);
        if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(() => this.connect(), 3000);
      };
      this.socket.onerror = () => {
        // Silently handled by onclose reconnect + offline fallback.
      };
    } catch {
      // Offline mode fallback.
    }
  }

  private send(payload: object): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  public sendChat(text: string): void {
    this.send({ type: 'chat', text });
  }

  public sendName(name: string): void {
    this.send({ type: 'set_name', name });
  }

  public sendTreeHit(treeIndex: number): void {
    const tree = this.vegetation.trees[treeIndex];
    if (!tree) return;
    this.send({ type: 'tree_hit', treeIndex, i: tree.i, j: tree.j });
  }

  public sendWoodLoot(dropId: string): void {
    this.send({ type: 'wood_loot', dropId });
  }

  public sendBlueprintPlace(i: number, j: number): void {
    this.send({ type: 'blueprint_place', i, j });
  }

  public sendWoodDeposit(amount: number): void {
    this.send({ type: 'wood_deposit', amount });
  }

  public update(dt: number, camYaw: number, demoActive: boolean): void {
    for (const peer of this.peers.values()) {
      peer.update(dt, camYaw, this.grid, demoActive);
    }

    if (this.isConnected && this.hero) {
      const now = performance.now();
      if (now - this.lastSendAt >= this.sendIntervalMs) {
        this.lastSendAt = now;
        this.send({
          type: 'update',
          x: this.hero.x,
          z: this.hero.z,
          face: this.hero.face,
          frame: this.hero.frame,
          crouch: this.hero.crouch,
          swing: this.hero.swing,
        });
      }
    }
  }

  private handleMessage(msg: any): void {
    switch (msg.type) {
      case 'welcome': {
        const isFirstWelcome = this.localId === null;
        this.localId = msg.id;
        if (msg.player) {
          if (isFirstWelcome) {
            this.hero.setSpawnTile(msg.player.x, msg.player.z);
          }
          if (msg.player.name) {
            this.hero.name = msg.player.name;
            this.callbacks.onSystemMessage?.(`Connected as ${msg.player.name}.`);
          }
        }
        this.clearPeers();
        if (Array.isArray(msg.existingPlayers)) {
          for (const p of msg.existingPlayers as PlayerData[]) {
            this.spawnPeer(p);
          }
        }
        if (msg.worldState) {
          this.hydrateWorldState(msg.worldState as WorldCoopSnapshot);
        }
        this.callbacks.onStatusChange?.(true, this.peers.size + 1);
        break;
      }

      case 'player_joined': {
        if (msg.player && msg.player.id !== this.localId) {
          this.spawnPeer(msg.player as PlayerData);
          this.callbacks.onStatusChange?.(true, this.peers.size + 1);
          this.callbacks.onSystemMessage?.(`${msg.player.name} joined Emberbrook Hollow.`);
        }
        break;
      }

      case 'player_left': {
        const peer = this.peers.get(msg.id);
        if (peer) {
          this.callbacks.onSystemMessage?.(`${peer.name} left.`);
          peer.destroy(this.scene);
          this.peers.delete(msg.id);
          this.callbacks.onStatusChange?.(true, this.peers.size + 1);
        }
        break;
      }

      case 'state_sync': {
        if (!Array.isArray(msg.players)) break;
        for (const p of msg.players as PlayerData[]) {
          if (p.id === this.localId) continue;
          const peer = this.peers.get(p.id);
          if (peer) peer.applyState(p);
          else this.spawnPeer(p);
        }
        break;
      }

      case 'player_chat': {
        if (msg.id !== this.localId) {
          this.peers.get(msg.id)?.showChat(msg.text);
        }
        this.callbacks.onChatMessage?.(msg.id, msg.name, msg.text);
        break;
      }

      case 'player_renamed': {
        if (msg.id === this.localId) {
          this.hero.name = msg.name;
        } else {
          this.peers.get(msg.id)?.setName(msg.name);
        }
        this.callbacks.onSystemMessage?.(`Traveler is now known as ${msg.name}.`);
        break;
      }

      case 'tree_updated': {
        const drop = msg.drop;
        this.hero.applyTreeHitVisualAndFX(msg.treeIndex, msg.hits, false);
        if (drop) {
          this.hero.spawnWoodDrop(drop.id, drop.i, drop.j, drop.quantity);
          if (msg.playerId === this.localId) {
            this.callbacks.onToast?.('Click or tap the logs to collect wood.', 2000);
          }
        }
        break;
      }

      case 'wood_looted': {
        this.hero.removeWoodDrop(msg.dropId);
        if (msg.playerId === this.localId) {
          this.hero.wood += msg.quantity;
          this.hero.onBuildStatusChange?.();
          this.callbacks.onToast?.(`+${msg.quantity} wood`, 1600);
        }
        break;
      }

      case 'blueprint_placed': {
        this.hero.applyBlueprintLocal(
          msg.i,
          msg.j,
          true,
          msg.playerId === this.localId ? undefined : msg.playerName
        );
        break;
      }

      case 'wood_deposited': {
        if (msg.playerId === this.localId) {
          this.hero.wood = Math.max(0, this.hero.wood - msg.accepted);
        }
        this.hero.applyWoodDepositLocal(
          msg.stored,
          msg.accepted,
          true,
          msg.playerId === this.localId ? undefined : msg.playerName
        );
        break;
      }

      case 'house_completed': {
        this.hero.applyHouseCompletedLocal(
          msg.i,
          msg.j,
          msg.roof ?? 'thatch',
          true,
          msg.playerId === this.localId ? undefined : msg.playerName
        );
        break;
      }

      case 'action_rejected': {
        if (msg.message) this.callbacks.onToast?.(msg.message, 2500);
        break;
      }
    }
  }

  private hydrateWorldState(snapshot: WorldCoopSnapshot): void {
    for (const [indexStr, hits] of Object.entries(snapshot.treeHits)) {
      const idxNum = Number(indexStr);
      if (hits > 0) this.vegetation.setTreeHitVisual(idxNum, hits);
    }
    for (const drop of snapshot.woodDrops) {
      this.hero.spawnWoodDrop(drop.id, drop.i, drop.j, drop.quantity);
    }
    for (const house of snapshot.completedHouses) {
      this.hero.applyHouseCompletedLocal(house.i, house.j, house.roof, false);
    }
    if (snapshot.buildingSite) {
      this.hero.applyBlueprintLocal(snapshot.buildingSite.i, snapshot.buildingSite.j, false);
      if (snapshot.buildingSite.stored > 0) {
        this.hero.applyWoodDepositLocal(snapshot.buildingSite.stored, snapshot.buildingSite.stored, false);
      }
    }
  }

  private spawnPeer(data: PlayerData): void {
    if (this.peers.has(data.id)) return;
    const peer = new RemoteTraveler(data, this.scene, this.labelsContainer);
    this.peers.set(data.id, peer);
  }

  private clearPeers(): void {
    for (const peer of this.peers.values()) {
      peer.destroy(this.scene);
    }
    this.peers.clear();
  }
}
