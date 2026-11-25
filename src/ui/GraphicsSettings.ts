import type { Engine } from '../core/Engine';
import {
  FRAME_LIMITS, GRAPHICS_PRESETS, RENDER_SCALES, VIEW_DISTANCES, type GraphicsOptions, type GraphicsPreset
} from '../core/GraphicsOptions';

const effects = [
  { key: 'shadows', label: 'Sun shadows', description: 'Cast shadows from trees and scenery.' },
  { key: 'animatedWater', label: 'Animated water', description: 'Animate ripples and highlights on the pond.' },
  { key: 'depthOfField', label: 'Depth of field', description: 'Soften the foreground and distant scenery.' }
] as const;

export function mountGraphicsSettings(container: HTMLElement, opener: HTMLButtonElement, engine: Engine): (fps: number) => void {
  const dialog = document.createElement('dialog');
  dialog.id = 'graphics-settings';
  dialog.className = 'ui-interactive';
  dialog.setAttribute('aria-labelledby', 'graphics-title');
  dialog.innerHTML = `
    <header class="graphics-header">
      <h2 id="graphics-title">Graphics</h2>
      <div class="graphics-fps"><span>Current FPS</span><output id="graphics-current-fps" aria-live="off">—</output></div>
    </header>
    <form method="dialog">
      <div class="graphics-options">
        <fieldset>
          <legend>Display</legend>
          <label class="graphics-field">
            <span>Preset</span>
            <select id="graphics-preset" autofocus>
              <option value="custom" disabled>Custom</option>
              ${Object.entries(GRAPHICS_PRESETS).map(([key, preset]) =>
                `<option value="${key}">${preset.label}</option>`).join('')}
            </select>
          </label>
          <label class="graphics-field">
            <span>Frame rate limit</span>
            <select id="graphics-frame-limit">
              ${FRAME_LIMITS.map(limit =>
                `<option value="${limit}">${limit === 'display' ? 'Display refresh rate' : `${limit} FPS`}</option>`).join('')}
            </select>
          </label>
          <label class="graphics-field">
            <span><span id="graphics-resolution-label">Render resolution</span> <small id="graphics-buffer-size"></small></span>
            <select id="graphics-render-scale" aria-labelledby="graphics-resolution-label" aria-describedby="graphics-buffer-size">
              ${RENDER_SCALES.map(scale => `<option value="${scale}">${Math.round(scale * 100)}%</option>`).join('')}
            </select>
          </label>
          <label class="graphics-field">
            <span>View distance</span>
            <select id="graphics-view-distance">
              ${Object.keys(VIEW_DISTANCES).map(distance =>
                `<option value="${distance}">${distance[0].toUpperCase() + distance.slice(1)}</option>`).join('')}
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>Effects</legend>
          ${effects.map(({ key, label, description }) => `
            <label class="graphics-field graphics-effect">
              <span>${label}<small>${description}</small></span>
              <input type="checkbox" id="graphics-${key}">
            </label>
          `).join('')}
        </fieldset>
      </div>
      <footer class="graphics-footer">
        <button type="button" class="ro-action-btn" id="graphics-reset">Reset preset</button>
        <button type="submit" class="ro-action-btn graphics-done">Done</button>
      </footer>
    </form>
  `;
  container.appendChild(dialog);

  const preset = dialog.querySelector<HTMLSelectElement>('#graphics-preset')!;
  const frameLimit = dialog.querySelector<HTMLSelectElement>('#graphics-frame-limit')!;
  const renderScale = dialog.querySelector<HTMLSelectElement>('#graphics-render-scale')!;
  const viewDistance = dialog.querySelector<HTMLSelectElement>('#graphics-view-distance')!;
  const reset = dialog.querySelector<HTMLButtonElement>('#graphics-reset')!;
  const currentFps = dialog.querySelector<HTMLOutputElement>('#graphics-current-fps')!;
  const bufferSize = dialog.querySelector<HTMLElement>('#graphics-buffer-size')!;
  const effectControls = effects.map(({ key }) => ({
    key,
    control: dialog.querySelector<HTMLInputElement>(`#graphics-${key}`)!
  }));
  let lastFps = 0;

  const refreshReadouts = () => {
    const { width, height } = engine.renderer.domElement;
    const size = `${width} × ${height} px`;
    const fps = lastFps > 0 ? String(lastFps) : '—';
    if (bufferSize.textContent !== size) bufferSize.textContent = size;
    if (currentFps.value !== fps) currentFps.value = fps;
  };

  const refresh = () => {
    const options = engine.graphics;
    const base = GRAPHICS_PRESETS[engine.graphicsPreset];
    const matchesPreset = (Object.keys(options) as (keyof GraphicsOptions)[])
      .every(key => options[key] === base.options[key]);
    preset.value = matchesPreset ? engine.graphicsPreset : 'custom';
    reset.disabled = matchesPreset;
    reset.textContent = `Reset to ${base.label}`;
    frameLimit.value = String(options.frameLimit);
    renderScale.value = String(options.renderScale);
    viewDistance.value = options.viewDistance;
    for (const { key, control } of effectControls) control.checked = options[key];
    refreshReadouts();
  };

  const update = (changes: Partial<GraphicsOptions>) => {
    engine.updateGraphics(changes);
    refresh();
  };

  opener.addEventListener('click', () => {
    refresh();
    dialog.showModal();
  });
  dialog.addEventListener('close', () => opener.focus());
  preset.addEventListener('change', () => {
    if (!Object.hasOwn(GRAPHICS_PRESETS, preset.value)) return;
    engine.setGraphics(preset.value as GraphicsPreset);
    refresh();
  });
  reset.addEventListener('click', () => {
    engine.setGraphics(engine.graphicsPreset);
    refresh();
    preset.focus();
  });
  frameLimit.addEventListener('change', () => {
    const limit = FRAME_LIMITS.find(value => String(value) === frameLimit.value);
    if (limit !== undefined) update({ frameLimit: limit });
  });
  renderScale.addEventListener('change', () => {
    const scale = RENDER_SCALES.find(value => String(value) === renderScale.value);
    if (scale !== undefined) update({ renderScale: scale });
  });
  viewDistance.addEventListener('change', () => {
    if (Object.hasOwn(VIEW_DISTANCES, viewDistance.value)) {
      update({ viewDistance: viewDistance.value as GraphicsOptions['viewDistance'] });
    }
  });
  for (const { key, control } of effectControls) {
    control.addEventListener('change', () => update({ [key]: control.checked }));
  }

  return fps => {
    lastFps = fps;
    if (dialog.open) refreshReadouts();
  };
}
