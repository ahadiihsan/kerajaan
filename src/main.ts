import './firebase';
import { Engine } from './core/Engine';
import { Environment } from './core/Environment';
import { FOREST_LIMIT, FOREST_NAME, ForestMap } from './map/ForestMap';
import { InputManager } from './character/InputManager';
import { CharacterController } from './character/CharacterController';
import { PlayerCrowd } from './character/PlayerCrowd';
import { ROCharacterAtlas } from './character/ROCharacterAtlas';
import { MultiplayerManager } from './multiplayer/MultiplayerManager';
import { HUD } from './ui/HUD';

async function bootstrap() {
  try {
    const engine = new Engine('app');
    await ROCharacterAtlas.init();

    const environment = new Environment(engine.scene);
    engine.registerUpdatable(environment);
    const forest = new ForestMap();
    engine.scene.add(forest.group);
    engine.registerUpdatable({
      update: (_delta, elapsed) => forest.updateWater(elapsed, engine.graphics.animatedWater)
    });

    const input = new InputManager();
    input.initRaycaster(engine.camera, forest.ground, FOREST_LIMIT);

    const player = new CharacterController(engine.camera, input, forest);
    engine.scene.add(player.mesh);
    engine.registerUpdatable(player);

    const multiplayer = new MultiplayerManager(engine.scene, player);
    engine.registerUpdatable({
      update: (delta) => multiplayer.update(delta, player.getCameraYaw())
    });

    const crowd = new PlayerCrowd(forest, 0);
    engine.scene.add(crowd.group);
    engine.registerUpdatable({
      update: (delta, elapsed) => crowd.update(delta, elapsed, player.getCameraYaw())
    });

    const hud = new HUD(forest, player, input, engine, crowd, multiplayer);
    hud.bindTimeControls(environment);
    engine.registerUpdatable(hud);
    hud.updateLoading(100, 100, FOREST_NAME);
    setTimeout(() => hud.hideLoading(), 250);
    engine.start();
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

window.addEventListener('DOMContentLoaded', bootstrap);
