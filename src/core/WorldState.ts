export interface WorldState {
  T: number;
  time: number;
  weather: number;
  flow: boolean;
  festival: boolean;
  raid: boolean;
  raidT: number;
  raidEndedAt: number;
  night: number;
  dayness: number;
  glow: number;
  golden: number;
  storm: number;
  tilt: number;
  focus: number;
  autoOrbit: boolean;
  fireflies: boolean;
  flash: number;
  shake: number;
  raidAmt: number;
  lightCD: number;
  boltT: number;
}

export const world: WorldState = {
  T: 0,
  time: 17.6,
  weather: 0,
  flow: false,
  festival: false,
  raid: false,
  raidT: 0,
  raidEndedAt: 0,
  night: 0,
  dayness: 1,
  glow: 0,
  golden: 0,
  storm: 0,
  tilt: 1,
  focus: 0.5,
  autoOrbit: true,
  fireflies: true,
  flash: 0,
  shake: 0,
  raidAmt: 0,
  lightCD: 3,
  boltT: 0,
};

export const PRESETS: Record<string, [number, number]> = {
  golden: [17.8, 0],
  midnight: [0.4, 0.04],
  storm: [15.5, 1],
  noon: [12, 0],
};

export const fmtTime = (t: number): string => {
  const h = Math.floor(t) % 24;
  const m = Math.floor((t % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const phaseName = (t: number): string =>
  t < 4
    ? 'Midnight Lanterns'
    : t < 6
      ? 'Before Dawn'
      : t < 8
        ? 'Dawn'
        : t < 11
          ? 'Morning'
          : t < 14
            ? 'High Noon'
            : t < 17
              ? 'Afternoon'
              : t < 19.3
                ? 'Golden Hour'
                : t < 21
                  ? 'Dusk'
                  : 'Lantern Night';

export const weatherName = (w: number): string =>
  w < 0.15 ? 'Clear skies' : w < 0.4 ? 'Overcast' : w < 0.7 ? 'Rain' : 'Heavy Thunderstorm';
