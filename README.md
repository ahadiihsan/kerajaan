# Kerajaan — Ragnarok Online 1 Prontera (2.5D HD-2D)

An authentic 2.5D HD-2D recreation of **Ragnarok Online 1's Capital City Prontera** built in Three.js and Vite, featuring official sprite animations, fixed isometric camera elevation, Octopath-style tilt-shift depth of field, real-time multiplayer, and high-performance crowd simulation.

🎮 **Live Deployment:** [https://kerajaan.web.app/](https://kerajaan.web.app/)  
📂 **Repository:** [https://github.com/ahadiihsan/kerajaan](https://github.com/ahadiihsan/kerajaan)

---

## ✨ Key Features

- **Official RO1 Arch Bishop & Blue Hair Sprite Sheets:**
  - 8-directional sprite atlas (80 composited frames: South, South-West, West, North-West, North, North-East, East, South-East).
  - Upright cylindrical billboarding (rotates on Y-axis with camera orbit, zero pitch tilt).
  - Authentic 8-beat walk cycles, standing idle, and sitting pose (`/sit` or `X`).
- **Iconic RO1 Visual Details:**
  - Classic 4-corner green targeting bracket cursor (`[  ]`) with snapping tile convergence.
  - Cyan battle HP gauge right under the character's feet.
  - Floating nametags, overhead speech bubbles, and emoji emote bubbles (`♥`, `!`, `?`, etc.).
  - Prontera Central Water Fountain centerpiece and merchant vending pushcarts with shop signboards.
- **Octopath Traveler Style HD-2D Presentation:**
  - Custom Dual-Pass Gaussian Blur Tilt-Shift post-processing lens.
  - Directional sunlight, warm street lanterns, and 2.5D contact drop shadows.
- **Prontera Crowd Simulation:**
  - High-performance InstancedMesh crowd supporting up to **1,000 players** locked at **75+ FPS**.
  - Dynamic density presets (`100`, `500`, `1,000` players) switchable in real time.
- **Multiplayer Architecture:**
  - Client networking in `src/multiplayer/MultiplayerManager.ts` with 20Hz state interpolation, speech bubbles, and chat.
  - In-game RO1 bottom-left chat window with channels and live online status.

---

## 🕹️ Controls

| Control | Action |
| :--- | :--- |
| **Left Click** | Move to tile (Authentic RO1 click-to-move with green cell targeting brackets) |
| **Right Click Drag** | Rotate horizontal camera orbit (fixed 37.2° isometric pitch elevation) |
| **Scroll Wheel** | Zoom camera in / out |
| **W, A, S, D** | Direct 8-directional character movement |
| **X / Insert** | Toggle sitting pose (`/sit`) |
| **Enter** | Focus in-game chat box to send messages or speech bubbles |

---

## 🛠️ Tech Stack

- **Renderer:** Three.js (WebGL)
- **Language:** TypeScript 5.7
- **Bundler:** Vite 6
- **Hosting & Analytics:** Firebase Hosting & Google Analytics (`kerajaan-app`)
- **Multiplayer Engine:** WebSockets (`ws`) / Firebase RTDB

---

## 🚀 Getting Started

### Local Development

1. **Clone the repository:**
   ```bash
   git clone git@github.com:ahadiihsan/kerajaan.git
   cd kerajaan
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Deployment

```bash
npm run build
firebase deploy --only hosting
```

## Character sprite inspection

Run `npm run dev` and open [Sprite Inspector](http://localhost:3000/sprites.html). The page includes the five active Rowan atlases, synchronized eight-direction animations, frame stepping, full-sheet cell selection, zoom, backgrounds, and authored hand-grip overlays. Sheet order includes all frames; game frame selection calls the current action selector (fishing uses a labeled staged demo). Equipped previews reuse the game’s 3D bow and arrow, plus 2D pixel-art axe and fishing rod sprites with a live line and bobber, with body-only comparison and selectable camera angles. Idle and walk can be previewed with any tool. The axe uses eight authored direction views, with an Open axe sheet link for inspection. The full character-sheet view remains body-only. The page is also included in production builds at `/sprites.html`.
