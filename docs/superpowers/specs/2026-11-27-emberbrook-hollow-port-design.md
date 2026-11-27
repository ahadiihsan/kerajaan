# Emberbrook Hollow Engine Port & Cooperative Multiplayer Design

**Date:** 2026-11-27  
**Reference:** [`docs/opus-5.5.html`](../../opus-5.5.html)  
**Target Branch:** `main` (original `main` preserved at `backup/main-pre-emberbrook`)

---

## 1. Goal & Scope

Replace the current `main` Three.js scene and engine with a clean, modular TypeScript + Vite + Three.js (`^0.174.0`) port of **Emberbrook Hollow** ([`docs/opus-5.5.html`](../../opus-5.5.html)), preserving every procedural texture, sprite, terrain tile, building, villager AI routine, dragon raid, festival, particle effect, post-processing shader, procedural 16-bit Web Audio soundtrack/SFX, HUD control, and Auto-Demo `.webm` recorder — while integrating real-time **cooperative WebSocket multiplayer and shared chat**.

### Decisions
- **Legacy assets & sprites:** Old Ragnarok Online sprite sheets (`Sprites/`, `public/sprites/`), medieval glTF packs (`models/`, `public/assets/medieval/`), and `scripts/generate_character_atlas.py` remain preserved on `backup/main-pre-emberbrook` and `feat/alderwood-forest` and are removed from `main`.
- **100% procedural rendering & audio:** Zero external image, model, or audio assets on `main`.
- **Cooperative WebSocket multiplayer:** Synchronizes connected travelers (position, facing, animation frame, crouch/swing, procedural outfit palette, name), live chat + overhead speech bubbles, and **shared cooperative world actions** (tree chopping, wood log drops/pickup, blueprint placement, and collaborative house construction).
- **Dungeon Master Deck & World Events:** Time of day, weather, lens controls, Harvest Festival, and Dragon Raid run locally per client (matching `opus-5.5.html`) so players can freely inspect and play with the DM sandbox without fighting over weather sliders.

---

## 2. Branching & Repository Cleanup

1. `backup/main-pre-emberbrook` points to commit `a91b6ab` (the pre-port `main`).
2. `main` keeps:
   - `package.json`, `tsconfig.json`, `vite.config.ts`, `firebase.json`, `src/firebase.ts`
   - `server/multiplayerServer.ts`, `server/standalone.ts`
   - `docs/opus-5.5.html` and `docs/superpowers/`
3. `main` removes legacy assets/code no longer used by Emberbrook Hollow:
   - `Sprites/`, `models/`, `public/`, `scripts/`
   - `src/core/AssetManager.ts`, `src/character/InputManager.ts`, `src/character/PixelSpriteSheet.ts`, `src/character/ROCharacterAtlas.ts`, `src/character/PlayerCrowd.ts`, `src/map/Blueprints.ts`, `src/map/LowPolyBuilder.ts`, `src/map/TownMap.ts`

---

## 3. Module Architecture

```text
src/
├── main.ts                         # Bootstrap: engine, world, entities, multiplayer, HUD, demo, loop
├── style.css                       # Emberbrook Hollow UI styles + subtle multiplayer status badge
├── firebase.ts                     # Existing Firebase Analytics initialization
├── utils/
│   ├── math.ts                     # clamp, lerp, smooth, easeIO, seeded PRNG + runtime switch, toRgb, shade
│   └── canvas.ts                   # cnv, fr, line, ctex, pixelize, mergeGeos
├── core/
│   ├── WorldState.ts               # Mutable world state, PRESETS, fmtTime, phaseName, weatherName
│   ├── Engine.ts                   # WebGLRenderer, PerspectiveCamera, PostProcess (tilt-shift + ACES), orbit/pan/zoom/shake, tweens
│   ├── Environment.ts              # Sky dome shader, stars, hemi/sun/point lights, palettes, tintVillager, fireflies, rain, lightning bolt
│   ├── Particles.ts                # Pool (fxAdd, fxNorm), chimney/forge/mill/rain/festival/dragonfire emitters
│   └── AudioEngine.ts              # Procedural 16-bit Web Audio soundtrack (peace/night/festival/battle) & SFX + MediaStreamDestination
├── world/
│   ├── Textures.ts                 # Procedural canvas textures (TX), roofMat, timberWall, gableTex, stoneWall, shared MAT
│   ├── WorldGrid.ts                # 72x72 grid (TOWN_SIZE=44), H/TYPE/BLOCK, stairs, lake, clearing, carve, groundY, A* findPath, reachList, gridOverlay
│   ├── TerrainBuilder.ts           # Tiered terrain, cliff/soil walls, river + edge waterfalls, 4-step stone stairs, mapSurfaces
│   ├── Buildings.ts                # 9 houses, Chapel, Watermill, Forge, Market stalls, Well, Fire pit, Street lamps + cones, Bridge, Festival bunting/pumpkins
│   ├── Vegetation.ts               # Instanced choppable trees, grass tufts, wheat stalks, rocks, hay bales
│   └── Wildlife.ts                 # Swimming ducks (lake) + walking deer (clearing)
├── entities/
│   ├── Sprites.ts                  # Procedural 16x24 sprite sheet generator (8 villager roles + 11-frame Traveler)
│   ├── Villager.ts                 # 23 autonomous villagers with RPG stats, inventory, festival/raid/night/work AI
│   ├── Dragon.ts                   # 4-frame dragon billboard, enter/circle/leave AI, fire breath & ground ignition
│   └── HeroController.ts           # Local playable hero, movement, axe chopping, log looting, blueprint placement & wood delivery
├── multiplayer/
│   ├── RemoteTraveler.ts           # Remote peer 11-frame Traveler sprite, smooth interpolation, groundY, tintVillager, nametag & bubble
│   └── MultiplayerManager.ts       # WebSocket client syncing players, chat, and cooperative world state
└── ui/
    ├── HUD.ts                      # Title, worldLabels, chat panel, DM Deck, RPG Inspector, Player Controls, banners & toasts
    └── AutoDemo.ts                 # 47s scripted camera/event demo & MediaRecorder .webm canvas+audio capture
```

---

## 4. Exact Behavioral & Visual Parity Rules

### 4.1 Deterministic World Generation
- `mulberry32(20261019)` drives all procedural textures, terrain carving, building palettes, tree placement (`trees[]`), tufts, wheat, rocks, hay bales, and initial villager attributes (`Villager` constructor) in the exact order of `opus-5.5.html`.
- Only after world generation and initial villager creation completes does `rand` switch to `Math.random` (`enableRuntimeRandom()`).
- **Guarantee:** Every connected browser client generates the exact same `trees` array (`0..trees.length-1`), `H`/`TYPE`/`BLOCK` grid, and `reachList`, allowing tree indices and tile coordinates `(i, j)` to be synchronized concisely over WebSocket.

### 4.2 Three.js `0.174.0` Porting Details
- Preserve `PerspectiveCamera(30, aspect, 0.5, 1400)`, `WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })`, `PCFSoftShadowMap`, `Fog(0x9fb8d8, 90, 220)`.
- Port the custom two-pass separable tilt-shift DoF + ACES tone-mapping/grading shader directly using `WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 })` and `THREE.HalfFloatType` for `rtB`.
- Ensure all `CanvasTexture` instances preserve `colorSpace = THREE.SRGBColorSpace`, `magFilter = THREE.NearestFilter`, and `minFilter` / `generateMipmaps` flags from `opus-5.5.html`.

### 4.3 Hero, Tools, and Cooperative Building Flow
- Local hero (`Rowan` offline, or server-assigned/renamed name online) spawns on `reachList[0]` (`(spawnI, spawnJ)`).
- Movement supports `WASD`, Arrow keys, mobile `#movePad`, and click-to-walk on `mapSurfaces` tiles (`walkToMapTile`). Camera-relative quadrant snapping matches `opus-5.5.html`.
- **Axe (`#axeTool`):** Clicking a non-chopped tree routes beside it and plays the 3-strike chop animation (`frames 7, 8`). On strike `3`, the tree disappears (`scale(0, 0, 0)`), `BLOCK` clears, `gridOverlay` refreshes, and a 3-log pile (`woodDrops`) drops at the tree's tile.
- **Blueprint (`#blueprintTool`):** Clicking a clear, flat 3×3 grass/field area with a clear south entrance tile (`j + 2`) places a shared `buildingSite` (`houseWoodCost = 6`).
- **Delivering Wood (`#depositWood` or clicking the blueprint):** Routes hero to `(site.i, site.j + 2)`, plays crouch/deliver animation (`frames 9/10`), deposits `min(hero.wood, 6 - site.stored)` wood, adds a visual log pile to `site.mesh`, and upon reaching `6/6` constructs a full thatched house (`makeHouse(site.i, site.j, 'S', { roof: 'thatch' })`) and adds its door to `doorTiles`.

---

## 5. Cooperative WebSocket Protocol (`server/multiplayerServer.ts` & `MultiplayerManager`)

### 5.1 Player State
`PlayerData` is updated for Emberbrook Hollow:
```ts
export interface TravelerLook {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  hatCol: string;
}

export interface PlayerData {
  id: string;
  name: string;
  look: TravelerLook;
  x: number;
  z: number;
  face: 1 | -1;
  frame: number;      // 0..10 in 11-frame Traveler sheet
  crouch: number;     // 0..1 vertical crouch factor
  swing: number;      // z-tilt during axe swing
  lastUpdate: number;
}
```
- Server assigns each newly connected player a unique `name` (e.g., `Traveler_1`) and a distinct procedural `TravelerLook` palette, spawning them on walkable plaza tiles near `(wx(23), wz(25))`.
- Local hero updates its name label to match its assigned name (and supports `/name <newName>` in chat to rename live).
- Remote peers render via `RemoteTraveler` using the exact same `characterSprite({ role: 'Traveler', ...look, shoes: '#2a1d14', hat: 'brim', pack: true }, 11)` generator, upright cylindrical billboarding (`rotation.y = cam.yaw`), `groundY(x, z)` placement, `tintVillager` ambient/lantern/fire tinting, and `#worldLabels` name tags + speech bubbles.

### 5.2 Cooperative World State (Server-Authoritative)
Server maintains `WorldCoopState`:
```ts
export interface WoodDropState {
  id: string;
  treeIndex: number;
  i: number;
  j: number;
  quantity: number;
}

export interface BuildingSiteState {
  i: number;
  j: number;
  stored: number;
}

export interface CompletedHouseState {
  i: number;
  j: number;
  roof: string;
}

export interface WorldCoopState {
  treeHits: Record<number, number>;        // treeIndex -> hits (1..3)
  woodDrops: WoodDropState[];              // active ground log piles
  buildingSite: BuildingSiteState | null;  // active blueprint (1 at a time)
  completedHouses: CompletedHouseState[];  // player-built houses
}
```

#### Message Types (Client ↔ Server)
1. **`welcome` (S→C):** `{ type: 'welcome', id, player, existingPlayers, worldState }`. Hydrates late-joiners with all chopped/damaged trees, active wood drops, current blueprint progress, and previously completed houses.
2. **`state_sync` (S→C @ 20 Hz):** `{ type: 'state_sync', players }` with all connected `PlayerData`.
3. **`update` (C→S @ 20 Hz):** `{ type: 'update', x, z, face, frame, crouch, swing }`.
4. **`chat` (C→S) / `player_chat` (S→C):** `{ type: 'chat', text }` → `{ type: 'player_chat', id, name, text }`. Appends to `#chatLog` and displays `#speechBubble` over the speaker's `#worldLabels` tag for 6 seconds. (In offline/disconnected mode, local chat still works identically to `opus-5.5.html`.)
5. **`tree_hit` (C→S) / `tree_updated` (S→C):** Client reports hit on `treeIndex`; server increments `treeHits[treeIndex]` (clamped to `3`). If `hits === 3`, server creates a `WoodDropState` (`id`, `treeIndex`, `i`, `j`, `quantity: 3`) and broadcasts `{ type: 'tree_updated', treeIndex, hits, drop? }`.
6. **`wood_loot` (C→S) / `wood_looted` (S→C):** Client requests looting `dropId`; server removes `dropId` atomically if still present and broadcasts `{ type: 'wood_looted', dropId, playerId, quantity }`. Only the winning client increments `hero.wood` (preventing duplication), while all clients remove the drop mesh and show a toast/animation cleanly.
7. **`blueprint_place` (C→S) / `blueprint_placed` (S→C):** If `buildingSite === null`, server sets `{ i, j, stored: 0 }` and broadcasts `{ type: 'blueprint_placed', i, j, playerId, playerName }`. If a peer already placed one, server sends a `toast` notice (`action_rejected`) instead of creating conflicting blueprints.
8. **`wood_deposit` (C→S) / `wood_deposited` & `house_completed` (S→C):** Client requests depositing `amount` wood (`1..hero.wood`); server clamps `accepted = Math.min(amount, 6 - site.stored)`, updates `site.stored += accepted`, and broadcasts `{ type: 'wood_deposited', playerId, playerName, accepted, stored }`. The depositing client deducts `accepted` from `hero.wood`. When `site.stored === 6`, server clears `buildingSite`, pushes `{ i, j, roof: 'thatch' }` to `completedHouses`, and broadcasts `{ type: 'house_completed', i, j, roof: 'thatch', playerName }`.

### 5.3 Offline / Disconnected Fallback
If the WebSocket server is unreachable (e.g., running static hosting without backend or before connection opens), `HeroController` executes tree hits, wood drops/loot, blueprint placement, and house completion locally with zero interruption — preserving 100% standalone playability of `opus-5.5.html`.

---

## 6. Verification Strategy

1. **Automated Unit Tests (`vitest` or Node test runner via `tsx`):**
   - World grid invariants: deterministic `H`/`TYPE`/`BLOCK`, `findPath` across stairs and bridge, `reachList` connectivity, `groundY` on flat tiles/stairs/bridge/river.
   - Cooperative server state machine (`MultiplayerServer` / `CoopWorldStore`): concurrent `wood_loot` atomicity (no double-loot), `tree_hit` clamping at `3`, collaborative multi-player `wood_deposit` reaching `6/6` -> `house_completed`, and `welcome` hydration payload.
2. **Typecheck & Production Build:**
   - `npm run build` (`tsc && vite build`) passes with zero TypeScript or bundler errors.
3. **Live Runtime & Visual Verification:**
   - Start `npm run dev` (which mounts `MultiplayerServer` on `/ws`), open two browser tabs in Playwright/browser subagent, verify:
     - Emberbrook Hollow scene renders cleanly (terrain, watermill, chapel, houses, villagers, sky/tilt-shift, DM Deck, Player Controls, Audio).
     - Both players appear on the plaza with procedural `Traveler` sprites and floating nametags.
     - Chat message from Tab 1 appears in Tab 2's `#chatLog` and overhead speech bubble.
     - Tab 1 chops a tree → wood drops in both tabs → Tab 1 or Tab 2 collects wood → Tab 1 places blueprint → both tabs deposit wood together → completed house spawns in both tabs.
     - DM Deck presets, Harvest Festival, Dragon Raid, Villager Inspector, and Auto-Demo run without console errors.
