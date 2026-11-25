# Kerajaan — Alderwood Forest

A multiplayer 2.5D forest built with Three.js and Vite. Start in the open Alder Glade with a small flock. Follow the hiking trails up Alder Rise and Lookout Ridge, or take the woodland paths to the Standing Stones and Fern Crossing. The time controls let you pause or change the day-night cycle.

## Local development

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Vite dev server also serves the multiplayer WebSocket at `/ws`. To use a standalone server, run `npm run server` and open `http://localhost:3000/?server=ws://localhost:3030`.

## Controls

| Input | Action |
| --- | --- |
| Left click or tap | Move to tile |
| W, A, S, D or arrow keys | Walk and hike trails |
| Space or Jump button | Jump onto low ledges or down to the next level |
| Right click and drag | Orbit camera |
| Scroll | Zoom |
| X or Insert | Sit or stand |
| Enter | Focus chat |

## Graphics

Open **Graphics** from the action bar. The panel shows the measured FPS and render resolution. Choose a preset, or set the frame cap, resolution scale, view distance, sun shadows, water animation, and depth of field independently. Changes apply immediately and are saved in the browser. Rendering pauses while the tab is hidden.

| Preset | Frame cap | Render scale | View distance | Effects |
| --- | --- | --- | --- | --- |
| Battery Saver | 30 FPS | 60% | Near | Baked water and ground shading |
| Performance | 60 FPS | 65% | Near | Baked water and ground shading |
| Balanced | 60 FPS | 100% | Standard | Animated water and sun shadows |
| Quality | 60 FPS | 150% | Far | Animated water, sun shadows, and tilt-shift depth of field |

Touch-first and lower-spec devices start in Performance when a preset hasn't been selected. Choose Battery Saver to cap the game at 30 FPS, or lower render resolution to reduce GPU work while keeping a higher cap.

Set simulated visitors to **0** to reduce CPU and GPU work further. Multiplayer players remain visible.

## Production build

```bash
npm run build
firebase deploy --only hosting
```
