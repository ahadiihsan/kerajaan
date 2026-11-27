import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoxGeometry, Group, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { HeroController } from '../src/entities/HeroController.ts';

function makeHero() {
  const deposits: number[] = [];
  const hero: HeroController = Object.assign(Object.create(HeroController.prototype), {
    scene: new Scene(),
    grid: { walkable: () => true, canStep: () => true, groundY: () => 0 },
    logGeometry: new BoxGeometry(),
    logMaterials: [new MeshBasicMaterial()],
    nextThrownDrop: 0,
    heldMoves: new Map(),
    focusHero: () => {},
    i: 20,
    j: 20,
    x: 0,
    z: 0,
    face: 1,
    wood: 5,
    meat: 4,
    woodDrops: [],
    meatDrops: [],
    coop: { isConnected: () => true, sendWoodDeposit: (amount: number) => deposits.push(amount) },
  });
  return { hero, deposits };
}

test('throwing uses the selected resource and puts the chosen quantity on the ground', () => {
  const { hero } = makeHero();
  const right = new Vector3(1, 0, 0);
  hero.throwCarriedItem(2, right);
  assert.equal(hero.woodDrops.length, 0);
  hero.setCarryItem('wood');
  hero.throwCarriedItem(1.5, right);
  hero.throwCarriedItem(6, right);
  hero.throwCarriedItem(2, right);
  assert.equal(hero.wood, 3);
  assert.equal(hero.carrying, 'wood');
  assert.deepEqual(hero.woodDrops.map(({ quantity, i, local }) => ({ quantity, i, local })), [
    { quantity: 2, i: 21, local: true },
  ]);
  hero.setCarryItem('meat');
  hero.throwCarriedItem(4, right);
  assert.equal(hero.meat, 0);
  assert.equal(hero.carrying, null);
  assert.equal(hero.meatDrops[0].quantity, 4);
});

test('delivery requires equipped wood and reserves it until the server responds', () => {
  const { hero, deposits } = makeHero();
  hero.buildingSite = { i: 20, j: 18, stored: 2, mesh: new Group() };
  hero.routeToTile = () => [];
  hero.beginDelivery(2);
  assert.equal(hero.interaction, undefined);

  hero.setCarryItem('wood');
  assert.equal(hero.deliveryLimit, 4);
  hero.beginDelivery(2);
  assert.equal(hero.interaction?.kind, 'build');
  Reflect.apply(Reflect.get(hero, 'updateInteraction'), hero, [1, new Vector3(1, 0, 0)]);

  assert.deepEqual(deposits, [2]);
  assert.equal(hero.throwLimit, 0);
  assert.equal(hero.deliveryLimit, 0);
  hero.resolveWoodDeposit(1);
  assert.equal(hero.wood, 4);
  assert.equal(hero.throwLimit, 4);
});
