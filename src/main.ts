import { Engine } from './core/Engine';
import { Environment } from './core/Environment';
import { AssetManager } from './core/AssetManager';
import { BlueprintLibrary } from './map/Blueprints';
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

    // 3. Initialize Asset Manager
    const assetMgr = new AssetManager();

    // 4. Input & Town Systems
    const input = new InputManager();
    const townMap = new TownMap(assetMgr);

    // 5. Player Character & Camera Controller
    const player = new CharacterController(engine.camera, input, townMap);
    engine.scene.add(player.mesh);
    engine.registerUpdatable(player);

    // 6. UI HUD (Loading screen, minimap, banners, mobile controls)
    const hud = new HUD(townMap, player, input);
    engine.registerUpdatable({
      update: () => hud.update()
    });

    // 7. Preload Required 3D Assets with Progress Tracking
    const requiredAssets = BlueprintLibrary.getRequiredModelNames();
    await assetMgr.preloadList(requiredAssets, (loaded, total, name) => {
      hud.updateLoading(loaded, total, name);
    });

    // 8. Assemble Town Map
    townMap.assembleTown();
    engine.scene.add(townMap.group);

    // 9. Start Game Loop & Reveal Scene
    engine.start();
    hud.hideLoading();

    console.log('🏰 Medieval Village Map initialized successfully!');
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

window.addEventListener('DOMContentLoaded', bootstrap);
