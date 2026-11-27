import './style.css';
import { AXE_SPRITE_URL } from '../entities/AxeSprite';
import { EquippedPreview, inspectionPose, type PreviewItem } from './EquippedPreview';
import grips from '../assets/characters/hand-grips.json';
import { playerActionFrame, type PlayerPose } from '../entities/PlayerSheet';

const sheets = {
  idle: new URL('../assets/characters/rowan-idle.png', import.meta.url).href,
  walk: new URL('../assets/characters/rowan-walk.png', import.meta.url).href,
  chop: new URL('../assets/characters/rowan-chop-body.png', import.meta.url).href,
  bow: new URL('../assets/characters/rowan-bow-body.png', import.meta.url).href,
  fish: new URL('../assets/characters/rowan-fish-body.png', import.meta.url).href,
};
type Action = keyof typeof sheets;
const directions = ['South', 'South-east', 'East', 'North-east', 'North', 'North-west', 'West', 'South-west'];
const params = new URLSearchParams(location.search);
let action: Action = params.get('action')! in sheets ? params.get('action') as Action : 'idle';
let row = Math.max(0, Math.min(7, Math.floor(Number(params.get('row'))) || 0));
let column = 0;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let elapsed = 0;
let image: HTMLImageElement;
let columns = 8;
let cell = 0;
let loadId = 0;
const cache = new Map<Action, HTMLImageElement>();
let equippedPreview: EquippedPreview | null = null;
let equipmentError = '';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header><div><p class="eyebrow">KERAJAAN / CHARACTER WORKSHOP</p><h1>Sprite inspector<span>Rowan</span></h1></div><a class="button" href="/">Back to game ↗</a></header>
  <main>
    <section class="toolbar" aria-label="Preview controls">
      <label>Animation<select id="action">${Object.keys(sheets).map(key => `<option value="${key}">${key[0].toUpperCase() + key.slice(1)}</option>`).join('')}</select></label>
      <label>Playback<select id="mode"><option value="sheet">Sheet order</option><option value="game">Game frame selection</option></select></label>
      <label><span id="rate-label">Frame rate · 6 fps</span><input id="rate" type="range" min="1" max="16" value="6" /></label>
      <label>Background<select id="background"><option value="checker">Checkerboard</option><option value="dark">Dark</option><option value="light">Light</option><option value="green">Forest green</option></select></label>
      <label>Item<select id="item"><option value="auto">Match animation</option><option value="none">Body only</option><option value="axe">Axe</option><option value="bow">Bow + arrow</option><option value="rod">Fishing rod</option></select></label>
      <label>Equipped camera<select id="pitch"><option value="37.2">Game angle · 37.2°</option><option value="0">Front · 0°</option><option value="60">High · 60°</option></select></label>
      <label class="check"><input id="grips" type="checkbox" /> Hand grips</label>
      <label class="check"><input id="guides" type="checkbox" checked /> Center guides</label>
    </section>
    <p class="notice">Equipped views use the game’s item artwork and hand attachments. The axe and fishing rod use 2D pixel-art sprites. Choose Body only to compare poses. The full atlas below stays body-only. Fishing uses a staged cast, reel and catch demo.</p>
    <p id="status" role="status">Loading sprite sheet…</p>
    <div class="workspace">
      <section class="panel focus-panel" aria-labelledby="focus-title">
        <div class="section-head"><div><p class="eyebrow">01 / FRAME INSPECTION</p><h2 id="focus-title">South</h2></div><span id="frame-label" class="badge"></span></div>
        <div class="stage checker" id="focus-stage"><canvas id="focus" width="512" height="512" aria-label="Selected sprite frame"></canvas></div>
        <div class="transport"><button id="previous" aria-label="Previous frame">←</button><button id="play">Pause</button><button id="next" aria-label="Next frame">→</button><label>Frame<input id="frame" type="range" min="0" max="7" value="0" /></label></div>
        <div class="focus-controls"><label>Direction<select id="direction">${directions.map((name, i) => `<option value="${i}">${i + 1} · ${name}</option>`).join('')}</select></label><label>Zoom<select id="zoom"><option value="1">1×</option><option value="2" selected>2×</option><option value="3">3×</option><option value="4">4×</option></select></label></div>
        <p id="coordinates" class="mono"></p><a id="item-art" class="button" href="${AXE_SPRITE_URL}" target="_blank" rel="noopener" hidden>Open 8-direction axe sheet ↗</a><p class="legend"><span class="left-dot"></span> Anatomical left <span class="right-dot"></span> Anatomical right</p>
      </section>
      <section class="panel" aria-labelledby="directions-title"><div class="section-head"><div><p class="eyebrow">02 / ANIMATED VIEW</p><h2 id="directions-title">Every direction, in sync</h2></div><span class="badge">8 directions</span></div><div class="directions">${directions.map((name, i) => `<button class="direction-card" data-row="${i}" aria-label="Inspect ${name}"><div class="stage checker"><canvas width="256" height="256"></canvas></div><span>${name}<small>Row ${i + 1}</small></span></button>`).join('')}</div><p id="sequence" class="mono"></p><p class="hint">Select a direction to inspect it. Pause or step to compare the same pose across all views.</p></section>
    </div>
    <section class="panel sheet-panel" aria-labelledby="sheet-title"><div class="section-head"><div><p class="eyebrow">03 / SHEET VIEW</p><h2 id="sheet-title">The full atlas</h2></div><a id="source" class="button" target="_blank" rel="noopener">Open PNG ↗</a></div><div class="sheet-controls"><label>Sheet scale<select id="sheet-scale"><option value="fit">Fit width</option><option value="1">1× native pixels</option><option value="2">2× native pixels</option></select></label><p id="metadata" class="mono"></p></div><p class="hint">Rows follow the direction labels below. Columns are numbered from 1. Select any cell to pause on that frame.</p><div class="sheet-layout"><div class="row-labels">${directions.map((name, i) => `<span>${i + 1} · ${name}</span>`).join('')}</div><div class="sheet-scroll"><div id="atlas" class="checker"><canvas id="sheet" tabindex="0" aria-label="Sprite sheet. Select a cell with the pointer, or use arrow keys to inspect frames."></canvas><div id="selection"></div></div></div></div></section>
    <footer>Space: play / pause · ← →: step frames · ↑ ↓: change direction · Frame and row numbers start at 1.</footer>
  </main>`;

function el<T extends HTMLElement = HTMLElement>(id: string): T { return document.getElementById(id) as T; }
const select = (id: string) => el<HTMLSelectElement>(id);
const checked = (id: string) => el<HTMLInputElement>(id).checked;
const value = (id: string) => Number(el<HTMLInputElement>(id).value);
select('action').value = action;
select('direction').value = String(row);

function gamePose(time: number): PlayerPose {
  const pose: PlayerPose = { chopTime: null, shotTime: 0.52, axeEquipped: false, bowEquipped: false, rodEquipped: false, fishingPose: null, fishingElapsed: 0 };
  if (action === 'chop') pose.chopTime = time % 0.78;
  if (action === 'bow') { pose.bowEquipped = true; pose.shotTime = time % 0.8; }
  if (action === 'fish') {
    const t = time % 3;
    pose.rodEquipped = true;
    pose.fishingPose = t < 0.3 ? null : t >= 2.4 ? 'hold' : 'cast';
    pose.fishingElapsed = Math.max(0, t - 0.3);
    pose.fishingReeling = t >= 1.6;
  }
  return pose;
}

function frameAt(time: number): number {
  if (select('mode').value === 'sheet') return Math.floor(time * value('rate')) % columns;
  if (action === 'idle') return Math.floor(time * 4) % columns;
  if (action === 'walk') return Math.floor(time * 10) % columns;
  return playerActionFrame(gamePose(time))?.column ?? 0;
}

function currentItem(): PreviewItem {
  const item = select('item').value;
  return item === 'auto' ? action === 'chop' ? 'axe' : action === 'bow' ? 'bow' : action === 'fish' ? 'rod' : 'none' : item as PreviewItem;
}

function paint(canvas: HTMLCanvasElement, direction: number, frame: number, size: number) {
  const item = currentItem();
  if (item !== 'none' && !equipmentError) {
    try {
      equippedPreview ??= new EquippedPreview(render);
      const pose = select('mode').value === 'game' && playing ? gamePose(elapsed) : inspectionPose(action, frame);
      equippedPreview.draw(canvas, image, action, direction, frame, item, pose,
        canvas.id === 'focus' ? value('zoom') / 2 : 1, value('pitch'), checked('grips'), checked('guides'));
      return;
    } catch {
      equipmentError = '3D item preview is unavailable in this browser. Showing body sprites.';
      el('status').textContent = equipmentError;
    }
  }
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  const x = (w - size) / 2;
  const y = h / 2 - size * (action === 'walk' ? 0.62 : 0.72);
  ctx.drawImage(image, frame * cell, direction * cell, cell, cell, x, y, size, size);
  if (checked('guides')) {
    ctx.strokeStyle = '#91a6be66';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.moveTo(0, y + size * (action === 'walk' ? 1 : 2.73 / 2.8)); ctx.lineTo(w, y + size * (action === 'walk' ? 1 : 2.73 / 2.8)); ctx.stroke();
  }
  if (checked('grips')) {
    const points = grips[action][direction][frame];
    for (const hand of ['left', 'right'] as const) {
      const [gx, gy] = points[hand];
      const px = action === 'walk'
        ? x + (((gx / 1.55 + 0.5) * 160 - 2) * 157 / 156) / cell * size
        : x + (gx / 2.8 + 0.5) * size;
      const py = action === 'walk'
        ? y + (((1 - gy / 1.55) * 160 - 2) * 157 / 156) / cell * size
        : y + ((2.73 - gy) / 2.8) * size;
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fillStyle = hand === 'left' ? '#39e9e0' : '#ff9dcb'; ctx.fill(); ctx.strokeStyle = '#101820'; ctx.stroke();
    }
  }
}

function renderSheet() {
  const canvas = el<HTMLCanvasElement>('sheet');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  ctx.strokeStyle = '#91a6be88'; ctx.lineWidth = 1;
  for (let c = 0; c < columns; c++) {
    ctx.beginPath(); ctx.moveTo(c * cell, 0); ctx.lineTo(c * cell, image.height); ctx.stroke();
    ctx.fillStyle = '#0b121fee'; ctx.fillRect(c * cell + 2, 2, 27, 22);
    ctx.fillStyle = '#f1f5f9'; ctx.font = '14px monospace'; ctx.fillText(String(c + 1), c * cell + 9, 18);
  }
  for (let r = 1; r < 8; r++) { ctx.beginPath(); ctx.moveTo(0, r * cell); ctx.lineTo(image.width, r * cell); ctx.stroke(); }
  resizeSheet();
}

function resizeSheet() {
  const scale = select('sheet-scale').value;
  el('atlas').style.width = scale === 'fit' ? '100%' : `${image.width * Number(scale)}px`;

}

function render() {
  if (!image) return;
  paint(el<HTMLCanvasElement>('focus'), row, column, cell * value('zoom'));
  document.querySelectorAll<HTMLButtonElement>('.direction-card').forEach((card, i) => {
    card.setAttribute('aria-pressed', String(i === row));
    paint(card.querySelector('canvas')!, i, column, 256);
  });
  el('item-art').hidden = currentItem() !== 'axe';
  el('focus-title').textContent = directions[row];
  el('frame-label').textContent = `Frame ${column + 1} / ${columns}`;
  el<HTMLInputElement>('frame').value = String(column);
  el('play').textContent = playing ? 'Pause' : 'Play';
  el('coordinates').textContent = `Row ${row + 1} · Column ${column + 1} · Crop x=${column * cell}, y=${row * cell}, ${cell}×${cell}px`;
  select('direction').value = String(row);
  const box = el('selection');
  Object.assign(box.style, { width: `${100 / columns}%`, height: '12.5%', left: `${column * 100 / columns}%`, top: `${row * 12.5}%` });
}

async function load() {
  const id = ++loadId;
  playing = false;
  el('status').textContent = 'Loading sprite sheet…';
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('#play, #previous, #next, #frame').forEach(control => control.disabled = true);
  try {
    let loaded = cache.get(action);
    if (!loaded) { loaded = new Image(); loaded.src = sheets[action]; await loaded.decode(); cache.set(action, loaded); }
    if (id !== loadId) return;
    image = loaded; cell = image.height / 8; columns = image.width / cell;
    column = 0; elapsed = 0;
    el<HTMLInputElement>('frame').max = String(columns - 1);
    el<HTMLAnchorElement>('source').href = sheets[action];
    el('metadata').textContent = `${image.width}×${image.height}px · ${columns} columns × 8 rows · ${cell}×${cell}px cells`;
    el('status').textContent = `${action.toUpperCase()} · ${columns * 8} frames loaded`;
    const query = new URLSearchParams({ action, row: String(row) });
    history.replaceState(null, '', `${location.pathname}?${query}`);
    renderSheet(); updateSequence();
    playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('#play, #previous, #next, #frame').forEach(control => control.disabled = false);
    render();
  } catch { if (id === loadId) el('status').textContent = `Could not load ${action} sheet. Select another animation or reload to retry.`; }
}

function updateSequence() {
  const game = select('mode').value === 'game';
  el<HTMLInputElement>('rate').disabled = game;
  el('sequence').textContent = game
    ? 'Game action-frame selector · Walk: 10 fps reference · Fishing: staged demo (rest → cast → wait → reel → catch); gameplay events control its actual duration.'
    : `Sheet order · Frames 1–${columns} · ${value('rate')} fps · Includes every atlas column, even poses skipped in gameplay.`;
}
function step(delta: number) { if (!image) return; playing = false; column = (column + delta + columns) % columns; render(); }
select('action').onchange = () => { action = select('action').value as Action; void load(); };
el('play').onclick = () => { playing = !playing; render(); };
el('previous').onclick = () => step(-1);
el('next').onclick = () => step(1);
el('frame').oninput = () => { playing = false; column = value('frame'); render(); };
select('direction').onchange = () => { row = value('direction'); render(); };
select('zoom').onchange = render;
select('mode').onchange = () => { elapsed = 0; updateSequence(); if (image) column = frameAt(0); render(); };
el('rate').oninput = () => { el('rate-label').textContent = `Frame rate · ${value('rate')} fps`; elapsed = 0; updateSequence(); };
for (const id of ['grips', 'guides', 'item', 'pitch']) el(id).onchange = render;
select('background').onchange = () => { document.querySelectorAll('.stage, #atlas').forEach(stage => { stage.className = `${stage.id === 'atlas' ? '' : 'stage '}${select('background').value}`; }); };
select('sheet-scale').onchange = resizeSheet;
document.querySelectorAll<HTMLButtonElement>('.direction-card').forEach((card, i) => { card.onclick = () => { row = i; render(); }; });
el('sheet').onclick = event => {
  if (!image) return;
  const rect = el('sheet').getBoundingClientRect();
  row = Math.min(7, Math.floor((event.clientY - rect.top) / rect.height * 8));
  column = Math.min(columns - 1, Math.floor((event.clientX - rect.left) / rect.width * columns));
  playing = false; render();
};
document.addEventListener('keydown', event => {
  if ((event.target as HTMLElement).matches('input, select, button, a')) return;
  if (![' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === ' ') { playing = !playing; render(); }
  if (event.key === 'ArrowLeft') step(-1);
  if (event.key === 'ArrowRight') step(1);
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { row = (row + (event.key === 'ArrowUp' ? 7 : 1)) % 8; render(); }
});
let last = performance.now();
let lastEquipmentRender = 0;
function tick(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (playing && image && !document.hidden) { elapsed += dt; const next = frameAt(elapsed); if (next !== column || (currentItem() !== 'none' && select('mode').value === 'game' && now - lastEquipmentRender > 33)) { column = next; render(); lastEquipmentRender = now; } }
  requestAnimationFrame(tick);
}
window.addEventListener('pagehide', event => { if (!event.persisted) equippedPreview?.dispose(); });
void load(); requestAnimationFrame(tick);
