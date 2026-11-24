import * as THREE from 'three';
import { RemotePlayer } from './RemotePlayer';
import { PlayerData } from '../../server/multiplayerServer';
import { CharacterController } from '../character/CharacterController';

export class MultiplayerManager {
  private scene: THREE.Scene;
  private localPlayer: CharacterController;
  private socket: WebSocket | null = null;

  public localId: string | null = null;
  public localName: string = 'Novice Traveler';
  public isConnected: boolean = false;

  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private lastSendTime: number = 0;
  private sendIntervalMs: number = 50; // 20Hz update rate

  // Events / Callbacks
  public onConnectionChange?: (connected: boolean, count: number) => void;
  public onChatMessage?: (senderName: string, message: string) => void;

  constructor(scene: THREE.Scene, localPlayer: CharacterController) {
    this.scene = scene;
    this.localPlayer = localPlayer;
    this.connect();
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      console.log(`[Multiplayer] Connecting to ${wsUrl}...`);
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('[Multiplayer] 🌐 Connected to Prontera Game Server!');
        this.isConnected = true;
        if (this.onConnectionChange) {
          this.onConnectionChange(true, this.remotePlayers.size + 1);
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('[Multiplayer] Failed to parse server message:', err);
        }
      };

      this.socket.onclose = () => {
        console.warn('[Multiplayer] Disconnected from server. Reconnecting in 3s...');
        this.isConnected = false;
        this.clearRemotePlayers();
        if (this.onConnectionChange) {
          this.onConnectionChange(false, 1);
        }
        setTimeout(() => this.connect(), 3000);
      };

      this.socket.onerror = (err) => {
        console.warn('[Multiplayer] WebSocket error:', err);
      };
    } catch (err) {
      console.warn('[Multiplayer] Could not initialize WebSocket:', err);
    }
  }

  private handleServerMessage(msg: any): void {
    switch (msg.type) {
      case 'welcome': {
        this.localId = msg.id;
        if (msg.player && msg.player.name) {
          this.localName = msg.player.name;
        }
        console.log(`[Multiplayer] Assigned player ID: ${this.localId} as ${this.localName}`);

        // Spawn existing players already in room
        if (Array.isArray(msg.existingPlayers)) {
          for (const pData of msg.existingPlayers) {
            this.spawnRemotePlayer(pData);
          }
        }
        if (this.onConnectionChange) {
          this.onConnectionChange(true, this.remotePlayers.size + 1);
        }
        break;
      }

      case 'player_joined': {
        if (msg.player && msg.player.id !== this.localId) {
          console.log(`[Multiplayer] Player joined: ${msg.player.name}`);
          this.spawnRemotePlayer(msg.player);
          if (this.onConnectionChange) {
            this.onConnectionChange(true, this.remotePlayers.size + 1);
          }
        }
        break;
      }

      case 'player_left': {
        if (msg.id && this.remotePlayers.has(msg.id)) {
          const p = this.remotePlayers.get(msg.id)!;
          console.log(`[Multiplayer] Player left: ${p.name}`);
          p.destroy(this.scene);
          this.remotePlayers.delete(msg.id);
          if (this.onConnectionChange) {
            this.onConnectionChange(true, this.remotePlayers.size + 1);
          }
        }
        break;
      }

      case 'state_sync': {
        if (Array.isArray(msg.players)) {
          for (const pData of msg.players) {
            if (pData.id === this.localId) continue; // Skip local player
            const remote = this.remotePlayers.get(pData.id);
            if (remote) {
              remote.updateState(pData);
            } else {
              this.spawnRemotePlayer(pData);
            }
          }
        }
        break;
      }

      case 'player_emote': {
        const remote = this.remotePlayers.get(msg.id);
        if (remote) {
          remote.showEmote(msg.emote);
        }
        break;
      }

      case 'player_chat': {
        const remote = this.remotePlayers.get(msg.id);
        if (remote) {
          remote.showChat(msg.text);
        }
        if (this.onChatMessage) {
          this.onChatMessage(msg.name, msg.text);
        }
        break;
      }
    }
  }

  private spawnRemotePlayer(data: PlayerData): void {
    if (this.remotePlayers.has(data.id)) return;
    const remote = new RemotePlayer(data);
    this.scene.add(remote.mesh);
    this.remotePlayers.set(data.id, remote);
  }

  private clearRemotePlayers(): void {
    for (const [_, p] of this.remotePlayers) {
      p.destroy(this.scene);
    }
    this.remotePlayers.clear();
  }

  public update(delta: number, cameraYaw: number): void {
    // 1. Update all remote player instances
    for (const [_, p] of this.remotePlayers) {
      p.update(delta, cameraYaw);
    }

    // 2. Throttled send of local player state to server (20Hz)
    const now = performance.now();
    if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
      if (now - this.lastSendTime >= this.sendIntervalMs) {
        this.lastSendTime = now;
        this.sendLocalUpdate();
      }
    }
  }

  private sendLocalUpdate(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const payload = {
      type: 'update',
      x: parseFloat(this.localPlayer.position.x.toFixed(2)),
      z: parseFloat(this.localPlayer.position.z.toFixed(2)),
      facingAngle: parseFloat(this.localPlayer.facingAngle.toFixed(3)),
      isMoving: (this.localPlayer as any).isMoving ?? false,
      isSitting: this.localPlayer.isSitting,
      direction: (this.localPlayer as any).direction ?? 'down',
      frameIndex: (this.localPlayer as any).frameIndex ?? 0
    };

    this.socket.send(JSON.stringify(payload));
  }

  public sendEmote(symbol: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({
      type: 'emote',
      emote: symbol
    }));
  }

  public sendChat(text: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({
      type: 'chat',
      text: text
    }));
  }

  public getOnlineCount(): number {
    return this.remotePlayers.size + 1;
  }
}
