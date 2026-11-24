import './firebase';
import { Engine } from './core/Engine';
import { Environment } from './core/Environment';
import { TownMap } from './map/TownMap';
import { InputManager } from './character/InputManager';
import { CharacterController } from './character/CharacterController';
import { PlayerCrowd } from './character/PlayerCrowd';
import { ROCharacterAtlas } from './character/ROCharacterAtlas';
import { MultiplayerManager } from './multiplayer/MultiplayerManager';
import { HUD } from './ui/HUD';

async function bootstrap() {
  try {
    // 1. Initialize Core Three.js Engine
    const engine = new Engine('app');

    // 2. Load Official Ragnarok Online Sprite Atlas (Arch Bishop + Blue Hair)
    await ROCharacterAtlas.init();

    // 3. Setup Prontera Environment & Terrain
    const env = new Environment(engine.scene);

    // 4. Assemble Prontera Town Map (Central Fountain, Vending Carts, Castle, Canal)
    const townMap = new TownMap();
    townMap.assembleTown();
    engine.scene.add(townMap.group);

    // 5. Input Manager with RO1 Click-to-Move Raycasting on Ground
    const input = new InputManager();
    input.initRaycaster(engine.camera, env.groundMesh);

    // 6. Ragnarok Online Player Character (Click-to-Move, Sitting /sit, Nametag)
    const player = new CharacterController(engine.camera, input, townMap);
    engine.scene.add(player.mesh);
    engine.registerUpdatable(player);

    // 7. Real-Time Multiplayer Manager (WebSocket Synchronization, Remote Players, Chat)
    const multiplayer = new MultiplayerManager(engine.scene, player);
    engine.registerUpdatable({
      update: (delta) => multiplayer.update(delta, player.getCameraYaw())
    });

    // 8. Prontera Player Crowd (Sitters, Wanders, Vending Banners, scalable up to 1,000)
    const crowd = new PlayerCrowd(townMap, 1000);
    crowd.setCrowdCount(100); // Clean, spacious default so player character is clearly visible
    engine.scene.add(crowd.group);
    engine.registerUpdatable({
      update: (delta, elapsed) => crowd.update(delta, elapsed, player.getCameraYaw())
    });

    // 9. RO1 Classic Windows HUD (Basic Info, Chat Box, Hotbar, Emotes, Minimap, DoF)
    const hud = new HUD(townMap, player, input, crowd, engine.dofPass, multiplayer);
    engine.registerUpdatable({
      update: () => hud.update()
    });

    // 10. Smooth reveal
    hud.updateLoading(100, 100, 'Prontera');
    setTimeout(() => {
      hud.hideLoading();
    }, 250);

    // 11. Start Game Loop
    engine.start();

    console.log('⚔️ Ragnarok Online 1 Multiplayer Prontera simulation running at 75 FPS!');
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

window.addEventListener('DOMContentLoaded', bootstrap);
