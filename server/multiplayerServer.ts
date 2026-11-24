import { WebSocketServer, WebSocket } from 'ws';

export interface PlayerData {
  id: string;
  name: string;
  color: string;
  x: number;
  z: number;
  facingAngle: number;
  isMoving: boolean;
  isSitting: boolean;
  direction: 'down' | 'up' | 'left' | 'right';
  frameIndex: number;
  lastUpdate: number;
}

export class MultiplayerServer {
  public wss: WebSocketServer;
  private players: Map<string, PlayerData> = new Map();
  private sockets: Map<string, WebSocket> = new Map();
  private broadcastInterval: NodeJS.Timeout | null = null;
  private nextPlayerNumber: number = 1;

  // RO1 Job Color Palette for diverse player classes
  private roJobThemes = [
    { name: 'Swordsman', color: '#2d5f8c', hair: '#e6a847' },
    { name: 'Mage', color: '#6c5ce7', hair: '#a29bfe' },
    { name: 'Archer', color: '#27ae60', hair: '#2ecc71' },
    { name: 'Acolyte', color: '#f5f6fa', hair: '#f1c40f' },
    { name: 'Thief', color: '#d35400', hair: '#e67e22' },
    { name: 'Merchant', color: '#8e44ad', hair: '#9b59b6' },
  ];

  constructor(serverOptions?: { noServer?: boolean; port?: number }) {
    this.wss = new WebSocketServer(serverOptions || { noServer: true });
    this.setupListeners();
    this.startBroadcastLoop();
  }

  private setupListeners(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const playerId = `player_${Math.random().toString(36).substring(2, 9)}`;
      const theme = this.roJobThemes[this.nextPlayerNumber % this.roJobThemes.length];
      const playerName = `${theme.name}_${this.nextPlayerNumber++}`;

      // Spawn in Prontera central plaza with slight random offset
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.5 + Math.random() * 5.0;
      const spawnX = Math.cos(angle) * radius;
      const spawnZ = 8.0 + Math.sin(angle) * radius;

      const newPlayer: PlayerData = {
        id: playerId,
        name: playerName,
        color: theme.color,
        x: spawnX,
        z: spawnZ,
        facingAngle: 0,
        isMoving: false,
        isSitting: false,
        direction: 'down',
        frameIndex: 0,
        lastUpdate: Date.now()
      };

      this.players.set(playerId, newPlayer);
      this.sockets.set(playerId, ws);

      console.log(`[Multiplayer] 🎮 ${playerName} (${playerId}) connected. Total: ${this.players.size}`);

      // 1. Welcome the new client with their ID and existing players list
      const existingList = Array.from(this.players.values()).filter((p) => p.id !== playerId);
      ws.send(JSON.stringify({
        type: 'welcome',
        id: playerId,
        player: newPlayer,
        existingPlayers: existingList
      }));

      // 2. Announce new player to existing clients
      this.broadcast({
        type: 'player_joined',
        player: newPlayer
      }, playerId);

      // 3. Handle incoming client messages
      ws.on('message', (data: string | Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleClientMessage(playerId, msg);
        } catch (err) {
          console.error('[Multiplayer] Invalid message format:', err);
        }
      });

      // 4. Handle client disconnect
      ws.on('close', () => {
        console.log(`[Multiplayer] 🚪 ${playerName} (${playerId}) disconnected.`);
        this.players.delete(playerId);
        this.sockets.delete(playerId);
        this.broadcast({
          type: 'player_left',
          id: playerId
        });
      });

      ws.on('error', (err) => {
        console.error(`[Multiplayer] Socket error for ${playerId}:`, err);
      });
    });
  }

  private handleClientMessage(playerId: string, msg: any): void {
    const player = this.players.get(playerId);
    if (!player) return;

    if (msg.type === 'update') {
      player.x = msg.x ?? player.x;
      player.z = msg.z ?? player.z;
      player.facingAngle = msg.facingAngle ?? player.facingAngle;
      player.isMoving = !!msg.isMoving;
      player.isSitting = !!msg.isSitting;
      player.direction = msg.direction || player.direction;
      player.frameIndex = msg.frameIndex ?? player.frameIndex;
      player.lastUpdate = Date.now();
    } else if (msg.type === 'emote') {
      // Broadcast emote bubble over player's head
      this.broadcast({
        type: 'player_emote',
        id: playerId,
        emote: msg.emote || '♥'
      });
    } else if (msg.type === 'chat') {
      // Classic RO1 Speech Bubble Broadcast
      const text = (msg.text || '').trim().substring(0, 100);
      if (text.length > 0) {
        console.log(`[Chat] <${player.name}>: ${text}`);
        this.broadcast({
          type: 'player_chat',
          id: playerId,
          name: player.name,
          text: text
        });
      }
    } else if (msg.type === 'set_name') {
      const sanitized = (msg.name || '').trim().substring(0, 20);
      if (sanitized.length > 0) {
        player.name = sanitized;
        this.broadcast({
          type: 'player_renamed',
          id: playerId,
          name: sanitized
        });
      }
    }
  }

  private startBroadcastLoop(): void {
    // 20Hz state synchronization tick
    this.broadcastInterval = setInterval(() => {
      if (this.players.size === 0) return;

      const playerList = Array.from(this.players.values());
      const payload = JSON.stringify({
        type: 'state_sync',
        players: playerList,
        timestamp: Date.now()
      });

      for (const [_, ws] of this.sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }, 50); // 50ms = 20 ticks per second
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
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
    this.wss.close();
  }
}
