export const FRAME_LIMITS = [30, 60, 120, 'display'] as const;
export const RENDER_SCALES = [0.5, 0.6, 0.65, 0.75, 0.85, 1, 1.25, 1.5] as const;
export const VIEW_DISTANCES = { near: 55, standard: 95, far: 115 } as const;

export interface GraphicsOptions {
  frameLimit: (typeof FRAME_LIMITS)[number];
  renderScale: (typeof RENDER_SCALES)[number];
  viewDistance: keyof typeof VIEW_DISTANCES;
  shadows: boolean;
  animatedWater: boolean;
  depthOfField: boolean;
}

export const GRAPHICS_PRESETS = {
  battery: {
    label: 'Battery Saver',
    options: { frameLimit: 30, renderScale: 0.6, viewDistance: 'near', shadows: false, animatedWater: false, depthOfField: false }
  },
  performance: {
    label: 'Performance',
    options: { frameLimit: 60, renderScale: 0.65, viewDistance: 'near', shadows: false, animatedWater: false, depthOfField: false }
  },
  balanced: {
    label: 'Balanced',
    options: { frameLimit: 60, renderScale: 1, viewDistance: 'standard', shadows: true, animatedWater: true, depthOfField: false }
  },
  quality: {
    label: 'Quality',
    options: { frameLimit: 60, renderScale: 1.5, viewDistance: 'far', shadows: true, animatedWater: true, depthOfField: true }
  }
} satisfies Record<string, { label: string; options: GraphicsOptions }>;

export type GraphicsPreset = keyof typeof GRAPHICS_PRESETS;

interface GraphicsPreference {
  preset: GraphicsPreset;
  options: GraphicsOptions;
}

const STORAGE_KEY = 'kerajaan.graphics.preferred';

function isPreset(value: unknown): value is GraphicsPreset {
  return typeof value === 'string' && Object.hasOwn(GRAPHICS_PRESETS, value);
}

function presetPreference(preset: GraphicsPreset): GraphicsPreference {
  return { preset, options: { ...GRAPHICS_PRESETS[preset].options } };
}

function readSavedOptions(value: unknown): GraphicsPreference | undefined {
  if (typeof value !== 'object' || !value) return;
  const { preset, options } = value as { preset?: unknown; options?: unknown };
  if (!isPreset(preset)) return;
  const preference = presetPreference(preset);
  if (typeof options !== 'object' || !options) return preference;
  const saved = options as Record<string, unknown>;
  const settings = preference.options;
  settings.frameLimit = FRAME_LIMITS.find(limit => limit === saved.frameLimit) ?? settings.frameLimit;
  settings.renderScale = RENDER_SCALES.find(scale => scale === saved.renderScale) ?? settings.renderScale;
  if (typeof saved.viewDistance === 'string' && Object.hasOwn(VIEW_DISTANCES, saved.viewDistance)) {
    settings.viewDistance = saved.viewDistance as GraphicsOptions['viewDistance'];
  }
  for (const key of ['shadows', 'animatedWater', 'depthOfField'] as const) {
    if (typeof saved[key] === 'boolean') settings[key] = saved[key];
  }
  return preference;
}

export function loadGraphics(): GraphicsPreference {
  try {
    const preferred = localStorage.getItem(STORAGE_KEY);
    if (isPreset(preferred)) return presetPreference(preferred);
    if (preferred) {
      const saved = readSavedOptions(JSON.parse(preferred));
      if (saved) return saved;
    }
    const legacy = localStorage.getItem('kerajaan.graphics');
    // The original Balanced value could have been written by the game on startup.
    if (legacy === 'performance' || legacy === 'quality') return presetPreference(legacy);
  } catch {
    // Storage may be unavailable or contain a value from an older build.
  }

  const { hardwareConcurrency, deviceMemory } = navigator as Navigator & { deviceMemory?: number };
  const constrained = (hardwareConcurrency > 0 && hardwareConcurrency <= 4) ||
    (deviceMemory !== undefined && deviceMemory <= 4) ||
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  return presetPreference(constrained ? 'performance' : 'balanced');
}

export function saveGraphics(preference: GraphicsPreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // The current session still uses the settings if storage is blocked.
  }
}
