import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDeerHit,
  createDeerState,
  DEER_MAX_HP,
  DEER_RESPAWN_SECONDS,
  DEER_SPOOK_SECONDS,
  tickDeerState,
} from '../src/world/Wildlife.ts';

describe('Wildlife deer hunting state', () => {
  it('spooks deer on first hit and defeats on second hit', () => {
    const deer = createDeerState(0);
    assert.equal(deer.hp, DEER_MAX_HP);
    assert.equal(deer.alive, true);

    const first = applyDeerHit(deer);
    assert.deepEqual(first, { hit: true, defeated: false });
    assert.equal(deer.hp, 1);
    assert.equal(deer.alive, true);
    assert.equal(deer.spookTimer, DEER_SPOOK_SECONDS);

    const second = applyDeerHit(deer);
    assert.deepEqual(second, { hit: true, defeated: true });
    assert.equal(deer.hp, 0);
    assert.equal(deer.alive, false);
    assert.equal(deer.respawnTimer, DEER_RESPAWN_SECONDS);

    // Extra hits while defeated are ignored
    assert.deepEqual(applyDeerHit(deer), { hit: false, defeated: false });
  });

  it('decays spook timer and respawns defeated deer after cooldown', () => {
    const deer = createDeerState(1);
    applyDeerHit(deer);
    tickDeerState(deer, 2);
    assert.equal(deer.spookTimer, DEER_SPOOK_SECONDS - 2);

    applyDeerHit(deer);
    assert.equal(deer.alive, false);

    assert.equal(tickDeerState(deer, DEER_RESPAWN_SECONDS - 1), false);
    assert.equal(deer.alive, false);

    assert.equal(tickDeerState(deer, 1), true);
    assert.equal(deer.alive, true);
    assert.equal(deer.hp, DEER_MAX_HP);
    assert.equal(deer.spookTimer, 0);
  });
});
