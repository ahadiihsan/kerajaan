import { Engine } from './core/Engine';
import { Environment } from './core/Environment';
import { TownMap } from './map/TownMap';
import { InputManager } from './character/InputManager';
import { CharacterController } from './character/CharacterController';
import { HUD } from './ui/HUD';

async function bootstrap() {
  try {
    // 1. Initialize Core Three.js Engine
    const engine = new Engine('app');

    // 2. Setup Atmospheric Environment & Terrain
    new Environment(engine.scene);

    // 3. Assemble Town Map (Instant, lightweight procedural low-poly architecture)
    const townMap = new TownMap();
    townMap.assembleTown();
    engine.scene.add(townMap.group);

    // 4. Input & Player Character
    const input = new InputManager();
    const player = new CharacterController(engine.camera, input, townMap);
    engine.scene.add(player.mesh);
    engine.registerUpdatable(player);

    // 5. UI HUD (Minimap radar, location banner, mobile controls)
    const hud = new HUD(townMap, player, input);
    engine.registerUpdatable({
      update: () => hud.update()
    });

    // 6. Fast instant reveal (Zero asset loading lag)
    hud.updateLoading(100, 100, 'Realm Ready');
    setTimeout(() => {
      hud.hideLoading();
    }, 250);

    // 7. Start Game Loop
    engine.start();

    console.log('🏰 Ultra-lightweight Medieval Village Map initialized at locked 60 FPS!');
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

window.addEventListener('DOMContentLoaded', bootstrap);
