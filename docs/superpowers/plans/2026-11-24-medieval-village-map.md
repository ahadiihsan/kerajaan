# Medieval Village Three.js Map Implementation Plan

**Goal:** Create a high-performance, visually rich Three.js medieval village map web application utilizing the modular Medieval Village MegaKit assets, featuring a full medieval town layout, third-person character controller, and dual desktop/mobile touch controls.

**Architecture:** Vite + TypeScript Three.js application. Modular Blueprint Assembly Engine with an AssetManager caching glTF parts. A TownMap coordinates streets, plazas, residential districts, props, fences, and collision boxes. An animated third-person character controller with trailing camera handles WASD + mouse on desktop and virtual joystick + swipe look on mobile.

**Tech Stack:** Three.js, TypeScript, Vite, Tailwind CSS / Vanilla CSS for HUD, HTML5 Canvas, WebGL.

---

### Task 1: Project Scaffolding & Asset Pipeline
- Setup `package.json`, Vite configuration, TypeScript config.
- Configure asset serving so glTF models and textures from `Medieval Village MegaKit[Standard]/glTF` are accessible via `/assets/medieval/`.
- Verify dev server build and asset loading.

### Task 2: Core Engine & Atmospheric Medieval Environment
- Build `src/core/Engine.ts`: Three.js Scene, WebGLRenderer (shadows, ACESFilmicToneMapping, sRGB), PerspectiveCamera, responsive resize handler, RAF game loop with delta time.
- Build `src/core/Environment.ts`: Medieval sky dome/gradient, directional sunlight with shadow maps, soft ambient/hemisphere lighting, ground terrain with cobblestone plaza and grassy meadows, warm atmospheric fog.

### Task 3: Asset Manager & Modular Blueprint Library
- Build `src/core/AssetManager.ts`: GLTFLoader with caching and cloning helper, handling materials and shadow casting/receiving flags.
- Build `src/map/Blueprints.ts`: Composed building prefabs built from kit pieces:
  - `TownHall`: Grand 2-story building with wide entryway, balconies, and chimneys.
  - `Tavern`: Long half-timbered building with dormer roofs and porch.
  - `ResidentialHouseA` & `ResidentialHouseB`: Varied 1-2 story medieval homes.
  - `CottageSmall`: Peasant home with steep roof and stone chimney.
  - `MarketStall`: Wooden stalls with awnings, display counters, and crates.
  - `TownWell`: Central village well and fountain for the plaza.
  - `WatchTower`: Multi-level wooden/stone watchtower.
  - `PerimeterFence`: Modular perimeter fences and gates.

### Task 4: Town Map Assembly & Collision System
- Build `src/map/TownMap.ts`:
  - Central Town Square / Market Plaza (cobblestone paving, well, market stalls, wagons, barrels, crates).
  - Main thoroughfare and winding residential alleys.
  - 20+ distinct buildings organized into natural town districts (Town Square, Merchant Street, Residential Quarter, Watchtower Overlook).
  - Perimeter fences, entry gates, rustic trees, and natural boundary hills.
  - Collision boundaries generation (Axis-Aligned Bounding Boxes or radius checks) for buildings and props.

### Task 5: Third-Person Character Controller & Dual Controls
- Build `src/character/CharacterController.ts`:
  - 3D avatar with smooth procedural or animated state machine (Idle, Walk, Run).
  - Physics-lite movement with velocity, acceleration, damping, and collision resolution against the town map's collision volumes.
  - Third-person orbiting trailing camera with collision pullback and smooth interpolation.
  - Dual Input Controller:
    - Desktop: WASD / Arrow keys, Shift (sprint), Space (jump), Mouse drag / pointer lock (camera).
    - Mobile: Virtual floating joystick for movement, touch swipe zone for camera orientation, on-screen sprint button.

### Task 6: HUD, Audio/Atmosphere & Polish
- Build `src/ui/HUD.ts`:
  - Medieval-themed district banner ("Elderstone Village - Town Square", etc.).
  - Minimap radar showing town layout and player position.
  - Mobile touch controls overlay.
  - Desktop control hints (fade away after movement).
  - Performance optimization (frustum culling, shadows tuning, 60fps target on mobile).

### Task 7: Verification & Visual Testing
- Run test suite / build verification (`npm run build`).
- Verify rendering, controls, lighting, and performance in browser.
