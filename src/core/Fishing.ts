import { clamp } from '../utils/math';

export const FISH = [
  { name: 'River Perch', rarity: 'Common', chance: 0.78, speed: 1.5, weight: [0.2, 0.9], color: '#d9e5aa' },
  { name: 'Silver Trout', rarity: 'Uncommon', chance: 0.208, speed: 2, weight: [0.5, 2.2], color: '#d2e7ed' },
  { name: 'Golden Carp', rarity: 'Very rare', chance: 0.01, speed: 2.5, weight: [1.4, 5.8], color: '#ffd074' },
  { name: 'Moonfin', rarity: 'Legendary', chance: 0.002, speed: 3, weight: [0.7, 3.7], color: '#ebc7ff' },
] as const;

export const CATCH_BAR_HEIGHT = 0.32;

export function rollFish(roll: number): number {
  let cumulative = 0;
  for (const [index, fish] of FISH.entries()) {
    cumulative += fish.chance;
    if (roll < cumulative) return index;
  }
  return FISH.length - 1;
}

export class FishingRound {
  readonly fish: number;
  readonly phase: number;
  elapsed = 0;
  bar = 0.5;
  position = 0.5;
  progress = 0.25;
  result: 'caught' | 'escaped' | null = null;
  private velocity = 0;

  constructor(public auto: boolean, private readonly random = Math.random) {
    this.fish = rollFish(random());
    this.phase = random() * Math.PI * 2;
    this.position = this.fishPosition();
    this.bar = this.position;
  }

  tap(): void {
    if (!this.auto && !this.result) this.velocity = 0.82;
  }

  private fishPosition(): number {
    const t = this.elapsed * FISH[this.fish].speed;
    return 0.5 + 0.25 * Math.sin(t + this.phase) + 0.08 * Math.sin(t * 1.7 - this.phase);
  }

  update(dt: number): void {
    if (this.result) return;
    this.elapsed += dt;
    this.position = this.fishPosition();
    const halfBar = CATCH_BAR_HEIGHT / 2;
    if (this.auto) {
      this.bar = this.position;
      this.velocity = 0;
    } else {
      this.velocity = Math.max(-0.65, this.velocity - 2.3 * dt);
      this.bar = clamp(this.bar + this.velocity * dt, halfBar, 1 - halfBar);
    }
    const tracking = Math.abs(this.bar - this.position) <= halfBar;
    this.progress = clamp(this.progress + (tracking ? 0.19 : -0.14) * dt, 0, 1);
    if (this.progress === 1) {
      this.result = this.auto && this.random() < 0.07 ? 'escaped' : 'caught';
    } else if (this.progress === 0 || this.elapsed >= 18) {
      this.result = 'escaped';
    }
  }
}
