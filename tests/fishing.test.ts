import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FishingRound, rollFish } from '../src/core/Fishing.ts';
import { HeroController } from '../src/entities/HeroController.ts';
import { WorldGrid, riverC } from '../src/world/WorldGrid.ts';

test('fishing requires an equipped rod and a stationary hero beside water', () => {
  const shore = riverC(15) + 2;
  const hero: HeroController = Object.assign(Object.create(HeroController.prototype), {
    grid: new WorldGrid(),
    i: shore,
    j: 15,
    rodEquipped: false,
  });
  assert.equal(hero.canFish(), false);
  hero.rodEquipped = true;
  assert.equal(hero.canFish(), true);
  hero.step = { dx: 1, dz: 0, progress: 0.2 };
  assert.equal(hero.canFish(), false);
  hero.step = null;
  hero.i = shore + 4;
  assert.equal(hero.canFish(), false);
});

test('catch rolls include both very rare fish', () => {
  assert.deepEqual([0, 0.78, 0.99, 0.999].map(rollFish), [0, 1, 2, 3]);
});

test('manual taps lift the bar and let a player track a fish', () => {
  const round = new FishingRound(false, () => 0);
  round.tap();
  round.update(1 / 60);
  assert.ok(round.bar > 0.5);
  for (let frame = 0; frame < 18 * 60 && !round.result; frame++) {
    if (round.bar < round.position - 0.02) round.tap();
    round.update(1 / 60);
  }
  assert.equal(round.result, 'caught');
});

test('losing track lets a fish escape', () => {
  const round = new FishingRound(false, () => 0);
  for (let frame = 0; frame < 18 * 60; frame++) round.update(1 / 60);
  assert.equal(round.result, 'escaped');
});

test('auto tracks the fish and can either land or lose it', () => {
  for (const [roll, result] of [[0.069, 'escaped'], [0.07, 'caught']] as const) {
    const rolls = [0.999, 0, roll];
    const round = new FishingRound(true, () => rolls.shift()!);
    while (!round.result) {
      round.update(1 / 60);
      assert.equal(round.bar, round.position);
    }
    assert.equal(round.fish, 3);
    assert.equal(round.result, result);
    round.update(1);
    assert.equal(round.result, result);
  }
});

test('switching to auto tracks the current fish and preserves progress', () => {
  const round = new FishingRound(false, () => 0.5);
  round.update(0.1);
  const progress = round.progress;
  round.auto = true;
  round.update(0.1);
  assert.equal(round.bar, round.position);
  assert.ok(Math.abs(round.progress - (progress + 0.019)) < 1e-9);

  round.auto = false;
  round.tap();
  const bar = round.bar;
  round.update(0.01);
  assert.ok(round.bar > bar);
});
