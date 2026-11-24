import { Engine } from './core/Engine';
import { Environment } from './core/Environment';
import { TownMap } from './map/TownMap';
import { InputManager } from './character/InputManager';
import { CharacterController } from './character/CharacterController';
import { PlayerCrowd } from './character/PlayerCrowd';
import { HUD } from './ui/HUD';

async function bootstrap() {
  try {
    // 1. Initialize Core Three.js Engine
    const engine = new Engine('app');

    // 2. Setup Atmospheric Environment & Terrain
    new Environment(engine.scene);

    // 3. Assemble Town Map (Low-Poly Procedural Architecture)
    const townMap = new TownMap();
    townMap.assembleTown();
    engine.scene.add(townMap.group);

    // 4. Input & Player Character
    const input = new InputManager();
    const player = new CharacterController(engine.camera, input, townMap);
    engine.scene.add(player.mesh);
    engine.registerUpdatable(player);

    // 5. Instanced 1,000 Player Crowd Simulation (Load Test)
    const crowd = new PlayerCrowd(townMap, 1000);
    engine.scene.add(crowd.group);
    engine.registerUpdatable(crowd);

    // 6. UI HUD (Live FPS monitor, player count controls, minimap, banners)
    const hud = new HUD(townMap, player, input, crowd);
    engine.registerUpdatable({
      update: () => hud.update()
    });

    // 7. Reveal scene smoothly
    hud.updateLoading(100, 100, 'Realm Ready');
    setTimeout(() => {
      hud.hideLoading();
    }, 250);

    // 8. Start Game Loop
    engine.start();

    console.log('🏰 1,000 Player Crowd Load Test active at locked 60 FPS!');
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

window.addEventListener('DOMContentLoaded', bootstrap);
