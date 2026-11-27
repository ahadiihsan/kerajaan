import * as THREE from 'three';
import './firebase';
import { enableRuntimeRandom, resetWorldSeed, V3 } from './utils/math';
import { world } from './core/WorldState';
import { createTextures } from './world/Textures';
import { WorldGrid } from './world/WorldGrid';
import { buildTerrain } from './world/TerrainBuilder';
import { buildBuildings } from './world/Buildings';
import { buildVegetation } from './world/Vegetation';
import { buildWildlife } from './world/Wildlife';
import { ParticleSystem } from './core/Particles';
import { AudioEngine } from './core/AudioEngine';
import { Environment } from './core/Environment';
import { Engine } from './core/Engine';
import { Dragon } from './entities/Dragon';
import { createVillagers } from './entities/Villager';
import { HeroController } from './entities/HeroController';
import { MultiplayerManager } from './multiplayer/MultiplayerManager';
import { HUD } from './ui/HUD';
import { AutoDemo } from './ui/AutoDemo';

function bootstrap(): void {
  const canvas = document.getElementById('c') as HTMLCanvasElement | null;
  const labelsContainer = document.getElementById('worldLabels');
  if (!canvas || !labelsContainer) return;

  // Deterministic seed for all world textures, terrain, buildings, vegetation, and initial villagers
  resetWorldSeed(20261019);

  const { TX, MAT, roofMat } = createTextures();
  const grid = new WorldGrid();

  // Create Engine (scene, camera, renderer, post-processing)
  const tempTint = new V3(1, 1, 1);
  const engine = new Engine(canvas, tempTint, new V3(0, 1.2, 0));

  const mapSurfaces = buildTerrain(engine.scene, grid, MAT);
  const buildings = buildBuildings(engine.scene, grid, TX, MAT, roofMat, mapSurfaces);
  const vegetation = buildVegetation(engine.scene, grid, buildings.nearDoor, MAT);
  const updateWildlife = buildWildlife(engine.scene, grid);
  grid.computeReachability();
  grid.createGridOverlay(engine.scene);

  const particles = new ParticleSystem(engine.scene);
  const env = new Environment(engine.scene, grid);
  tempTint.copy(env.tint);

  const audio = new AudioEngine(() => ({
    x: engine.cam.target.x,
    z: engine.cam.target.z,
    dist: engine.cam.dist,
  }));

  const dragon = new Dragon(engine.scene);

  let villagers: ReturnType<typeof createVillagers> = [];
  villagers = createVillagers(buildings.houses, buildings.chapel.door, {
    scene: engine.scene,
    grid,
    buildings,
    fxAdd: particles.fxAdd,
    fxNorm: particles.fxNorm,
    audio,
    camRight: engine.camRight,
    getCamYaw: () => engine.cam.yaw,
    getDragonState: () => dragon,
    getVillagerCount: () => villagers.length,
  });

  // Wire MultiplayerManager + HeroController + HUD
  let hud!: HUD;
  const multiplayer = new MultiplayerManager({
    scene: engine.scene,
    grid,
    vegetation,
    labelsContainer,
    callbacks: {
      onStatusChange: (connected, count) => hud?.setMultiplayerStatus(connected, count),
      onChatMessage: (_id, name, text) => hud?.appendChatMessage(name, text),
      onSystemMessage: (text) => hud?.appendChatMessage('System', text, true),
      onToast: (msg, ms) => hud?.toast(msg, ms),
    },
  });

  const hero = new HeroController({
    scene: engine.scene,
    grid,
    buildings,
    vegetation,
    TX,
    MAT,
    fxNorm: particles.fxNorm,
    villagers,
    toast: (msg, ms) => hud?.toast(msg, ms),
    focusHero: () => hud?.focusHero(),
    coop: {
      isConnected: () => multiplayer.isConnected,
      sendTreeHit: (idx) => multiplayer.sendTreeHit(idx),
      sendWoodLoot: (id) => multiplayer.sendWoodLoot(id),
      sendBlueprintPlace: (i, j) => multiplayer.sendBlueprintPlace(i, j),
      sendWoodDeposit: (amt) => multiplayer.sendWoodDeposit(amt),
    },
  });
  multiplayer.attachHero(hero);

  // Align camera target with hero spawn
  engine.cam.target.set(hero.x, grid.groundY(hero.x, hero.z) + 0.75, hero.z);
  engine.goal.target.copy(engine.cam.target);

  hud = new HUD({
    engine,
    grid,
    buildings,
    vegetation,
    mapSurfaces,
    TX,
    fxNorm: particles.fxNorm,
    audio,
    dragon,
    villagers,
    hero,
    multiplayer,
  });

  const autoDemo = new AutoDemo({
    engine,
    env,
    audio,
    buildings,
    dragon,
    villagers,
    hero,
    hud,
  });
  hud.bindAutoDemo(
    () => autoDemo.start(),
    () => autoDemo.active
  );
  (window as unknown as { startAutoDemo: () => Promise<void> }).startAutoDemo = () => autoDemo.start();

  const onResize = () =>
    engine.resize((pr) => {
      particles.fxAdd.mat.uniforms.pr.value =
        particles.fxNorm.mat.uniforms.pr.value =
        env.fireflies.m.uniforms.pr.value =
          pr;
    });
  window.addEventListener('resize', onResize);
  onResize();

  // World generation complete — switch to runtime randomness
  enableRuntimeRandom();
  multiplayer.connect();

  let last = performance.now();
  function frame(now: number): void {
    requestAnimationFrame(frame);
    const real = Math.min(0.5, (now - last) / 1000);
    const dt = Math.min(0.05, real);
    last = now;
    world.T += dt;

    engine.updateTweens(real);
    if (world.flow) world.time = (world.time + dt * 0.08) % 24;
    if (world.raid && (world.raidT += dt) > 34 && !autoDemo.active) hud.endRaid();

    env.applyEnvironment(dt, engine.scene, buildings, MAT, audio);
    tempTint.copy(env.tint);

    hero.update(dt, engine.cam.yaw, engine.camRight, autoDemo.active);
    multiplayer.update(dt, engine.cam.yaw, autoDemo.active);
    updateWildlife(world.T);

    engine.updateCamera(dt, {
      followHero: hud.followHero,
      followSelected: hud.follow,
      demoActive: autoDemo.active,
      heroPos: { x: hero.x, y: grid.groundY(hero.x, hero.z), z: hero.z },
      selectedPos: hud.selected
        ? {
            x: hud.selected.x,
            y: grid.groundY(hud.selected.x, hud.selected.z),
            z: hud.selected.z,
            hidden: hud.selected.hidden,
          }
        : null,
      skyGroup: env.skyGroup,
      sun: env.sun,
      sunDir: env.sunDir,
      rainCenter: env.rain.m.uniforms.center.value,
    });

    for (const v of villagers) {
      v.update(dt);
      env.tintActor(v, buildings.lightSources, particles.fires);
    }
    env.tintActor(hero, buildings.lightSources, particles.fires);
    for (const peer of multiplayer.peers.values()) {
      env.tintActor(peer, buildings.lightSources, particles.fires);
    }

    dragon.update(dt, {
      camYaw: engine.cam.yaw,
      camRight: engine.camRight,
      grid,
      villagers,
      particles,
      audio,
    });
    dragon.mat.color.copy(env.spriteTint).addScalar(dragon.flash * 0.25);

    buildings.mill.wheel.rotation.x -= dt * 0.9;
    TX.water.offset.set(Math.sin(world.T * 0.3) * 0.05, world.T * 0.12);
    TX.falls.offset.y = world.T * 0.9;
    env.fireflies.m.uniforms.time.value = env.rain.m.uniforms.time.value = world.T;

    particles.update(dt, {
      grid,
      buildings,
      camTarget: engine.cam.target,
      bonLight: env.bonLight,
      fireLight: env.fireLight,
      dragonFlash: dragon.flash,
      dragonBreathing: dragon.breathing,
      dragonTarget: dragon.target,
      audio,
      onStrike: () => env.strike(audio),
      bolt: env.bolt,
    });

    if (hud.selected && !hud.selected.hidden) {
      const y = grid.groundY(hud.selected.x, hud.selected.z);
      hud.selRing.visible = hud.selArrow.visible = true;
      hud.selRing.position.set(hud.selected.x, y + 0.04, hud.selected.z);
      (hud.selRing.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.4 * Math.sin(world.T * 6);
      hud.selArrow.position.set(
        hud.selected.x,
        y + 1.5 * hud.selected.sc + 0.45 + Math.sin(world.T * 5) * 0.08,
        hud.selected.z
      );
    } else {
      hud.selRing.visible = hud.selArrow.visible = false;
    }

    hud.updateUI(dt);
    engine.render();
    hud.updateNameLabels(now);
    autoDemo.compositeIfActive();
  }

  requestAnimationFrame(frame);
}

window.addEventListener('DOMContentLoaded', bootstrap);
