import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { MultiplayerServer } from '../server/multiplayerServer.ts';

function connectClient(port: number): Promise<{ ws: WebSocket; messages: any[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const messages: any[] = [];
    ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
    ws.on('open', () => resolve({ ws, messages }));
    ws.on('error', reject);
  });
}

async function waitFor(messages: any[], predicate: (m: any) => boolean, timeoutMs = 2000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = messages.find(predicate);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error('Timed out waiting for WebSocket message');
}

describe('MultiplayerServer cooperative integration', () => {
  let server: MultiplayerServer | null = null;

  afterEach(() => {
    server?.stop();
    server = null;
  });

  it('syncs chat, tree chopping, wood looting, and cooperative house building across two clients', async () => {
    const port = 31991;
    server = new MultiplayerServer({ port });

    const c1 = await connectClient(port);
    const w1 = await waitFor(c1.messages, (m) => m.type === 'welcome');
    assert.equal(w1.player.name, 'Rowan');

    const c2 = await connectClient(port);
    const w2 = await waitFor(c2.messages, (m) => m.type === 'welcome');
    assert.equal(w2.existingPlayers.length, 1);

    // Chat broadcast
    c1.ws.send(JSON.stringify({ type: 'chat', text: 'Let us build together!' }));
    const chatOnC2 = await waitFor(c2.messages, (m) => m.type === 'player_chat');
    assert.equal(chatOnC2.text, 'Let us build together!');
    assert.equal(chatOnC2.name, 'Rowan');

    // Client 1 chops tree #12 three times -> drops 3 wood
    for (let k = 0; k < 3; k++) {
      c1.ws.send(JSON.stringify({ type: 'tree_hit', treeIndex: 12, i: 10, j: 12 }));
    }
    const felled = await waitFor(c2.messages, (m) => m.type === 'tree_updated' && m.hits === 3);
    assert.ok(felled.drop?.id);

    // Client 2 loots the dropped wood; duplicate loot by Client 1 is ignored
    const dropId = felled.drop.id;
    c2.ws.send(JSON.stringify({ type: 'wood_loot', dropId }));
    const looted = await waitFor(c1.messages, (m) => m.type === 'wood_looted' && m.dropId === dropId);
    assert.equal(looted.playerId, w2.id);
    assert.equal(looted.quantity, 3);

    // Client 1 places blueprint; Client 1 & Client 2 each deposit 3 wood -> house completed
    c1.ws.send(JSON.stringify({ type: 'blueprint_place', i: 28, j: 40 }));
    await waitFor(c2.messages, (m) => m.type === 'blueprint_placed' && m.i === 28 && m.j === 40);

    c1.ws.send(JSON.stringify({ type: 'wood_deposit', amount: 3 }));
    await waitFor(c2.messages, (m) => m.type === 'wood_deposited' && m.stored === 3);

    c2.ws.send(JSON.stringify({ type: 'wood_deposit', amount: 3 }));
    const built = await waitFor(c1.messages, (m) => m.type === 'house_completed');
    assert.equal(built.i, 28);
    assert.equal(built.j, 40);
    assert.equal(built.roof, 'thatch');

    c1.ws.close();
    c2.ws.close();
  });
});
