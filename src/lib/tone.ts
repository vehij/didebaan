import { nextReset, type Schedule } from './time';

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Hue stops for "how full is this limit": green when there is room, through amber, to red at the cap. */
const STOPS: [pct: number, hue: number][] = [
  [0, 155],
  [50, 120],
  [70, 80],
  [85, 50],
  [100, 25],
];

export function usageHue(pct: number): number {
  const p = Math.max(0, Math.min(100, pct));
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, h1] = STOPS[i];
    const [p0, h0] = STOPS[i - 1];
    if (p <= p1) return h0 + ((p - p0) / (p1 - p0)) * (h1 - h0);
  }
  return STOPS[STOPS.length - 1][1];
}

/** CSS color for a usage level; `lightness` lets the same hue serve fills, text and glows. */
export function usageColor(pct: number, lightness = 0.66, chroma = 0.17): string {
  return `oklch(${lightness} ${chroma} ${usageHue(pct).toFixed(1)})`;
}

/** Share of the current weekly window that has already passed, 0–1. */
export function weekElapsed(s: Schedule, now: Date): number {
  const end = nextReset(s, now).getTime();
  return Math.max(0, Math.min(1, 1 - (end - now.getTime()) / WEEK));
}

export interface Pace {
  /** Usage minus time elapsed, in percentage points; positive means burning faster than the week. */
  ahead: number;
  /** When the limit runs out at the current rate, if that is before the reset. */
  runsOutAt: Date | null;
}

export function paceOf(usedPct: number, s: Schedule, now: Date): Pace {
  const elapsed = weekElapsed(s, now);
  const ahead = usedPct - elapsed * 100;
  // Too early in the week or nothing used yet: a projection would be noise.
  if (usedPct <= 0 || elapsed < 0.05 || usedPct >= 100) return { ahead, runsOutAt: null };
  const fractionAtCap = (elapsed * 100) / usedPct;
  if (fractionAtCap >= 1) return { ahead, runsOutAt: null };
  const start = nextReset(s, now).getTime() - WEEK;
  return { ahead, runsOutAt: new Date(start + fractionAtCap * WEEK) };
}
