# Emberbrook Hollow Engine Port & Cooperative Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy Three.js scene on `main` with a modular TypeScript + Vite + Three.js (`^0.174.0`) port of **Emberbrook Hollow** ([`docs/opus-5.5.html`](../../opus-5.5.html)), integrated with cooperative WebSocket multiplayer and shared chat.

**Architecture:** Decompose `opus-5.5.html` into focused modules (`src/utils`, `src/core`, `src/world`, `src/entities`, `src/multiplayer`, `src/ui`) preserving the deterministic `mulberry32(20261019)` world-generation sequence so all clients share identical tile/tree indices, while `server/multiplayerServer.ts` coordinates player sync, chat, and cooperative tree chopping, wood drops, and house building.

**Tech Stack:** TypeScript 5.7, Vite 6.2, Three.js 0.174, Web Audio API, `ws` 8.23, Node built-in test runner (`node --test` via `tsx` or `--experimental-strip-types`).

**Spec:** [`docs/superpowers/specs/2026-11-27-emberbrook-hollow-port-design.md`](../specs/2026-11-27-emberbrook-hollow-port-design.md)

## Global Constraints
- `backup/main-pre-emberbrook` preserves `a91b6ab`; never force-push or rewrite it.
- Zero external image, model, or audio assets on `main` (all procedural).
- `tsconfig.json` has `"strict": true` and `"noImplicitReturns": true`; `npm run build` (`tsc && vite build`) must pass cleanly.
- Deterministic RNG `mulberry32(20261019)` must run through textures, terrain, buildings, vegetation, wildlife, and initial `Villager` creation before switching to `Math.random`.
- Cooperative WebSocket sync must support offline fallback when disconnected.

---

### Task 1: Clean Legacy Assets & Code on `main`

**Files:**
- Remove: `Sprites/`, `models/`, `public/`, `scripts/`, `src/core/AssetManager.ts`, `src/character/`, `src/map/`
- Keep: `package.json`, `tsconfig.json`, `vite.config.ts`, `firebase.json`, `src/firebase.ts`, `server/`, `docs/`

- [ ] Remove legacy asset directories and superseded source directories using `git rm -rf` and commit the cleanup checkpoint.

### Task 2: Utilities, World Grid & A\* Pathfinding (`src/utils/`, `src/world/WorldGrid.ts`)

**Files:**
- Create: `src/utils/math.ts`
- Create: `src/utils/canvas.ts`
- Create: `src/world/WorldGrid.ts`
- Test: `tests/worldGrid.test.ts`

- [ ] Implement `math.ts` (`V3`, `clamp`, `lerp`, `smooth`, `easeIO`, `mulberry32`, `rand`, `enableRuntimeRandom`, `R`, `RI`, `pick`, `toRgb`, `shade`).
- [ ] Implement `canvas.ts` (`cnv`, `fr`, `line`, `ctex`, `pixelize`, `mergeGeos`).
- [ ] Implement `WorldGrid.ts` (`TOWN_SIZE=44`, `N=72`, `ORIGIN=22`, `TH=1.2`, `WATER_Y=0.85`, `BASE_Y=-1.8`, `T`, `H`, `TYPE`, `BLOCK`, `stairs`, `lake`, `clearing`, `PC`, `PCW`, `HOUSES`, `FACE`, `carve`, `groundY`, `walkable`, `canStep`, `findPath`, `reachList`, `randomReach`, `gridOverlay`, `refreshGrid`).
- [ ] Write & run `tests/worldGrid.test.ts` verifying deterministic grid bounds, stair transitions, bridge walkability, `groundY`, and A\* paths.

### Task 3: Procedural Textures, Terrain, Buildings, Vegetation & Wildlife (`src/world/`)

**Files:**
- Create: `src/world/Textures.ts`
- Create: `src/world/TerrainBuilder.ts`
- Create: `src/world/Buildings.ts`
- Create: `src/world/Vegetation.ts`
- Create: `src/world/Wildlife.ts`

- [ ] Port `TX`, `roofTex`, `roofMat`, `timberWall`, `gableTex`, `stoneWall`, `MAT`, `shadowed` into `Textures.ts`.
- [ ] Port `buildTerrain` into `TerrainBuilder.ts` (returning `mapSurfaces`, river, edge waterfalls, 4-step stone stairs).
- [ ] Port `Buildings.ts` (`makeHouse`, `chapel`, `mill`, `forge`, `stalls`, well, `firePit`, `lamps` + `coneMat` cones, bridge, `festGroup`, `glowSprite`, `windowMats`, `glows`, `lightSources`, `chimneys`, `houseLights`, `doorTiles`, `nearDoor`).
- [ ] Port `Vegetation.ts` (instanced `trees` + `treeMeshes`, `setTreeHitVisual`, grass tufts, wheat, rocks, hay bales).
- [ ] Port `Wildlife.ts` (3 ducks on `lake`, 3 deer in `clearing`, `updateWildlife`).

### Task 4: Core Engine, WorldState, Environment, Particles & Audio (`src/core/`)

**Files:**
- Create: `src/core/WorldState.ts`
- Create: `src/core/Particles.ts`
- Create: `src/core/Environment.ts`
- Create: `src/core/AudioEngine.ts`
- Create: `src/core/Engine.ts` (replace old Engine)

- [ ] Port `WorldState.ts` (`world` state, `PRESETS`, `fmtTime`, `phaseName`, `weatherName`, `overlay`).
- [ ] Port `Particles.ts` (`Pool`, `fxAdd`, `fxNorm`, `rockets`, `fires`, `updateFX`).
- [ ] Port `Environment.ts` (`skyGroup`, `skyMat`, `stars`, `hemi`, `sun`, `bonLight`, `fireLight`, `PAL`, `applyEnvironment`, `tintVillager`, `fireflies`, `rain`, `bolt`, `strike`).
- [ ] Port `AudioEngine.ts` (Web Audio 16-bit sequencer + SFX + `dest` MediaStreamDestination).
- [ ] Port `Engine.ts` (`WebGLRenderer`, `PerspectiveCamera`, `scene`, `cam`/`goal`, orbit/pan/zoom/shake, `PostProcess` two-pass tilt-shift + ACES shader, `tween`, `camTo`, `resize`).

### Task 5: Sprites, Villagers, Dragon & Hero Controller (`src/entities/`)

**Files:**
- Create: `src/entities/Sprites.ts`
- Create: `src/entities/Villager.ts`
- Create: `src/entities/Dragon.ts`
- Create: `src/entities/HeroController.ts`

- [ ] Port `Sprites.ts` (`makeLook`, `drawChar`, `characterSprite`, `CharacterLook` + `TRAVELER_PALETTES` for distinct multiplayer peers).
- [ ] Port `Villager.ts` (`ROLE`, `ROSTER`, `Villager` class, 23 villagers, festival/raid/night/work AI).
- [ ] Port `Dragon.ts` (4-frame dragon sprite, `enter`/`leave`/`updateDragon`, `igniteAt`).
- [ ] Port `HeroController.ts` (local hero `Rowan`, movement, `axeEquipped`, `placingBlueprint`, `buildingSite`, `woodDrops`, `interaction`, `makeLogPile`, `hitTree` + `applyRemoteTreeHit`, `dropWood`, `placeBlueprint` + `applyRemoteBlueprint`, `finishDelivery` + `applyRemoteDeposit`/`applyRemoteHouseComplete`, cooperative callbacks).

### Task 6: Cooperative WebSocket Server & Client (`server/`, `src/multiplayer/`)

**Files:**
- Create: `server/coopWorld.ts`
- Modify: `server/multiplayerServer.ts`
- Modify: `vite.config.ts`
- Create: `src/multiplayer/RemoteTraveler.ts`
- Rewrite: `src/multiplayer/MultiplayerManager.ts`
- Test: `tests/coopWorld.test.ts`

- [ ] Extract `CoopWorldStore` into `server/coopWorld.ts` (tree hits, wood drops, atomic loot, single active blueprint, cooperative wood deposit up to 6, completed houses, `getSnapshot()`).
- [ ] Write & run `tests/coopWorld.test.ts` verifying atomic wood loot, cooperative multi-player house construction, and rejection of conflicting blueprints.
- [ ] Update `server/multiplayerServer.ts` and `server/standalone.ts` / `vite.config.ts` to use Emberbrook `PlayerData` (`x`, `z` at plaza `wx(23), wz(25)`, `face`, `frame`, `crouch`, `swing`, `look`) and `CoopWorldStore` messages.
- [ ] Implement `RemoteTraveler.ts` (11-frame procedural Traveler sprite, smooth interpolation, `groundY`, `tintVillager`, `#worldLabels` tag & `#speechBubble`).
- [ ] Rewrite `MultiplayerManager.ts` to sync local hero, remote travelers, multiplayer chat, and cooperative tree/wood/blueprint/house events cleanly.

### Task 7: HUD, AutoDemo, Styles, HTML & Entry Point (`index.html`, `src/style.css`, `src/ui/`, `src/main.ts`)

**Files:**
- Modify: `index.html`
- Rewrite: `src/style.css`
- Rewrite: `src/ui/HUD.ts`
- Create: `src/ui/AutoDemo.ts`
- Rewrite: `src/main.ts`

- [ ] Update `index.html` with full Emberbrook Hollow DOM (`#c`, `#title`, `#worldLabels`, `#chat`, `#deckToggle`, `#deck`, `#inspector`, `#banner`, `#caption`, `#playerControls`, `#toast`, `#demoBtn`, `#recHud`, plus subtle online peer counter pill).
- [ ] Port `src/style.css` verbatim from `opus-5.5.html` `<style>` with responsive rules and online badge styling.
- [ ] Port `HUD.ts` (DM Deck, presets, World Events, Lens, Music, Villager Inspector + portrait canvas + follow, Local/Multiplayer Chat + speech bubbles + `/name` command, `#worldLabels` for hero + remote travelers + nearby NPCs, Player Controls bar, raycasting click/hover).
- [ ] Port `AutoDemo.ts` (47s choreography, `MediaRecorder` `.webm` capture + HUD canvas composite).
- [ ] Wire `src/main.ts` so `mulberry32(20261019)` completes deterministic generation, `enableRuntimeRandom()` switches to `Math.random`, WebSocket connects, and `requestAnimationFrame` drives the full Emberbrook Hollow loop.

### Task 8: Final Verification

- [ ] Run unit tests (`node --experimental-strip-types --test tests/*.test.ts` or `npx tsx --test tests/*.test.ts`).
- [ ] Run `npm run build` (`tsc && vite build`).
- [ ] Launch dev server (`npm run dev`), test two concurrent browser clients in headless/webview browser for rendering, chat, tree chopping, wood looting, and cooperative house building, and verify zero console/page errors.
