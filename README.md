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

Choose a preset from the action bar. Touch-first devices and devices that report four CPU threads or less, or 4 GB of memory or less, start in Performance. The browser remembers new preset selections. An older saved Balanced value uses the device default because earlier versions saved it automatically. Rendering pauses while the tab is hidden.

| Preset | Frame cap | Max render pixel ratio | Effects |
| --- | --- | --- | --- |
| Performance | 30 FPS | 0.75× | Baked water highlights and ground shading |
| Balanced | 60 FPS | 1× | Animated water and sun shadows |
| Quality | 60 FPS | 1.5× | Animated water, sun shadows, and tilt-shift depth of field |

Set simulated visitors to **0** to reduce CPU and GPU work further. Multiplayer players remain visible.

## Production build

```bash
npm run build
firebase deploy --only hosting
```
