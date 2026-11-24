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

    // 2. Setup Prontera Environment & Terrain
    const env = new Environment(engine.scene);

    // 3. Assemble Prontera Town Map (Central Fountain, Vending Carts, Castle, Canal)
    const townMap = new TownMap();
    townMap.assembleTown();
    engine.scene.add(townMap.group);

    // 4. Input Manager with RO1 Click-to-Move Raycasting on Ground
    const input = new InputManager();
    input.initRaycaster(engine.camera, env.groundMesh);

    // 5. Ragnarok Online Player Character (Click-to-Move, Sitting /sit, Nametag)
    const player = new CharacterController(engine.camera, input, townMap);
    engine.scene.add(player.mesh);
    engine.registerUpdatable(player);

    // 6. Prontera 1,000 Player Crowd (Sitters, Wanders, Vending Banners)
    const crowd = new PlayerCrowd(townMap, 1000);
    engine.scene.add(crowd.group);
    engine.registerUpdatable(crowd);

    // 7. RO1 Classic Windows HUD (Basic Info, HP/SP, Hotbar, Emotes, Minimap)
    const hud = new HUD(townMap, player, input, crowd);
    engine.registerUpdatable({
      update: () => hud.update()
    });

    // 8. Smooth reveal
    hud.updateLoading(100, 100, 'Prontera');
    setTimeout(() => {
      hud.hideLoading();
    }, 250);

    // 9. Start Game Loop
    engine.start();

    console.log('⚔️ Ragnarok Online 1 Prontera simulation initialized at 75 FPS!');
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

window.addEventListener('DOMContentLoaded', bootstrap);
