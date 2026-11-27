import { WebSocket, WebSocketServer } from 'ws';
import { TRAVELER_FRAME_COUNT } from '../src/entities/TravelerFrames';
import { CoopWorldStore } from './coopWorld';

export interface TravelerLook {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  hatCol: string;
}

export interface PlayerData {
  id: string;
  name: string;
  look: TravelerLook;
  x: number;
  z: number;
  face: 1 | -1;
  frame: number;
  crouch: number;
  swing: number;
  lastUpdate: number;
}

const TRAVELER_PALETTES: TravelerLook[] = [
  { skin: '#c68a5e', hair: '#3b2416', shirt: '#3f91a0', pants: '#333a54', hatCol: '#274c69' },
  { skin: '#f1c7a0', hair: '#6b3e1f', shirt: '#a8453a', pants: '#3a3448', hatCol: '#5e2420' },
  { skin: '#e0ac83', hair: '#e3c060', shirt: '#4f8a4b', pants: '#3b2e23', hatCol: '#2b5230' },
  { skin: '#f5d6b8', hair: '#1d1a22', shirt: '#6c4fa0', pants: '#2d2b3e', hatCol: '#412d68' },
  { skin: '#c68a5e', hair: '#c94a2a', shirt: '#c07a32', pants: '#3b2f26', hatCol: '#6e4219' },
  { skin: '#8d5a3b', hair: '#8a8a8a', shirt: '#3a6fa8', pants: '#2a3040', hatCol: '#1f3e60' },
];

const PLAZA_SPAWN_TILES: Array<[number, number]> = [
  [22, 25],
  [22, 24],
  [24, 24],
  [24, 26],
  [21, 25],
  [23, 27],
];

const wx = (i: number): number => i - 22 + 0.5;
const wz = (j: number): number => j - 22 + 0.5;

export class MultiplayerServer {
  public wss: WebSocketServer;
  private players: Map<string, PlayerData> = new Map();
  private sockets: Map<string, WebSocket> = new Map();
  private broadcastInterval: NodeJS.Timeout | null = null;
  private nextPlayerNumber = 1;
  private readonly coop = new CoopWorldStore();

  constructor(serverOptions?: { noServer?: boolean; port?: number }) {
    this.wss = new WebSocketServer({ ...(serverOptions || { noServer: true }), maxPayload: 8192 });
    this.setupListeners();
    this.startBroadcastLoop();
  }

  private setupListeners(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const playerId = `player_${Math.random().toString(36).substring(2, 9)}`;
      const index = this.nextPlayerNumber - 1;
      const playerName = index === 0 ? 'Rowan' : `Traveler_${this.nextPlayerNumber}`;
      this.nextPlayerNumber++;

      const look = TRAVELER_PALETTES[index % TRAVELER_PALETTES.length];
      const [si, sj] = PLAZA_SPAWN_TILES[index % PLAZA_SPAWN_TILES.length];

      const newPlayer: PlayerData = {
        id: playerId,
        name: playerName,
        look,
        x: wx(si),
        z: wz(sj),
        face: 1,
        frame: 0,
        crouch: 0,
        swing: 0,
        lastUpdate: Date.now(),
      };

      this.players.set(playerId, newPlayer);
      this.sockets.set(playerId, ws);

      console.log(`[Multiplayer] 🎮 ${playerName} (${playerId}) connected. Total: ${this.players.size}`);

      const existingList = Array.from(this.players.values()).filter((p) => p.id !== playerId);
      ws.send(
        JSON.stringify({
          type: 'welcome',
          id: playerId,
          player: newPlayer,
          existingPlayers: existingList,
          worldState: this.coop.getSnapshot(),
        })
      );

      this.broadcast(
        {
          type: 'player_joined',
          player: newPlayer,
        },
        playerId
      );

      ws.on('message', (data: string | Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleClientMessage(playerId, msg, ws);
        } catch (err) {
          console.error('[Multiplayer] Invalid message format:', err);
        }
      });

      ws.on('close', () => {
        console.log(`[Multiplayer] 🚪 ${newPlayer.name} (${playerId}) disconnected.`);
        this.players.delete(playerId);
        this.sockets.delete(playerId);
        this.broadcast({
          type: 'player_left',
          id: playerId,
        });
      });

      ws.on('error', (err) => {
        console.error(`[Multiplayer] Socket error for ${playerId}:`, err);
      });
    });
  }

  private handleClientMessage(playerId: string, msg: any, ws: WebSocket): void {
    const player = this.players.get(playerId);
    if (!player) return;

    switch (msg.type) {
      case 'update': {
        if (Number.isFinite(msg.x)) player.x = Math.max(-24, Math.min(52, msg.x));
        if (Number.isFinite(msg.z)) player.z = Math.max(-24, Math.min(52, msg.z));
        player.face = msg.face === -1 ? -1 : 1;
        player.frame = Number.isFinite(msg.frame) ? Math.max(0, Math.min(TRAVELER_FRAME_COUNT - 1, Math.floor(msg.frame))) : 0;
        player.crouch = Number.isFinite(msg.crouch) ? Math.max(0, Math.min(1, msg.crouch)) : 0;
        player.swing = Number.isFinite(msg.swing) ? Math.max(-1, Math.min(1, msg.swing)) : 0;
        player.lastUpdate = Date.now();
        break;
      }

      case 'chat': {
        const text = String(msg.text || '')
          .replace(/[\x00-\x1f\x7f]/g, '')
          .trim()
          .substring(0, 120);
        if (text.length > 0) {
          console.log(`[Chat] <${player.name}>: ${text}`);
          this.broadcast({
            type: 'player_chat',
            id: playerId,
            name: player.name,
            text,
          });
        }
        break;
      }

      case 'set_name': {
        const sanitized = String(msg.name || '')
          .replace(/[\x00-\x1f\x7f]/g, '')
          .trim()
          .substring(0, 20);
        if (sanitized.length > 0) {
          player.name = sanitized;
          this.broadcast({
            type: 'player_renamed',
            id: playerId,
            name: sanitized,
          });
        }
        break;
      }

      case 'tree_hit': {
        const treeIndex = Number(msg.treeIndex);
        const tileI = Number(msg.i);
        const tileJ = Number(msg.j);
        if (!Number.isInteger(tileI) || !Number.isInteger(tileJ)) return;
        const result = this.coop.hitTree(treeIndex, tileI, tileJ);
        if (!result.ok) return;
        this.broadcast({
          type: 'tree_updated',
          treeIndex,
          hits: result.hits,
          drop: result.drop ?? null,
          playerId,
        });
        break;
      }

      case 'wood_loot': {
        const dropId = String(msg.dropId || '');
        const drop = this.coop.lootDrop(dropId);
        if (!drop) return;
        this.broadcast({
          type: 'wood_looted',
          dropId: drop.id,
          playerId,
          playerName: player.name,
          quantity: drop.quantity,
        });
        break;
      }

      case 'blueprint_place': {
        const i = Number(msg.i);
        const j = Number(msg.j);
        const res = this.coop.placeBlueprint(i, j);
        if (!res.ok) {
          ws.send(JSON.stringify({ type: 'action_rejected', action: 'blueprint_place', message: res.reason }));
          return;
        }
        this.broadcast({
          type: 'blueprint_placed',
          i: res.site.i,
          j: res.site.j,
          playerId,
          playerName: player.name,
        });
        break;
      }

      case 'wood_deposit': {
        const amount = Number(msg.amount);
        const res = this.coop.depositWood(amount);
        if (!res.ok) {
          ws.send(JSON.stringify({ type: 'action_rejected', action: 'wood_deposit', message: res.reason }));
          return;
        }
        this.broadcast({
          type: 'wood_deposited',
          playerId,
          playerName: player.name,
          accepted: res.accepted,
          stored: res.stored,
        });
        if (res.completedHouse) {
          this.broadcast({
            type: 'house_completed',
            i: res.completedHouse.i,
            j: res.completedHouse.j,
            roof: res.completedHouse.roof,
            playerId,
            playerName: player.name,
          });
        }
        break;
      }
    }
  }

  private startBroadcastLoop(): void {
    this.broadcastInterval = setInterval(() => {
      if (this.players.size === 0) return;
      const payload = JSON.stringify({
        type: 'state_sync',
        players: Array.from(this.players.values()),
        timestamp: Date.now(),
      });
      for (const [, ws] of this.sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }, 50);
  }

  public broadcast(data: object, excludeId?: string): void {
    const payload = JSON.stringify(data);
    for (const [id, ws] of this.sockets) {
      if (excludeId && id === excludeId) continue;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  public stop(): void {
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
    this.wss.close();
  }
}
