import { describe, expect, it } from 'vitest';
import { paceOf, usageHue, weekElapsed } from './tone';

// Monday 2026-10-26 18:40; weekly reset Thursday 10:30, so the window began Thu 2026-10-22 10:30.
const now = new Date(2026, 9, 26, 18, 40);
const s = { weekday: 4 as const, time: '10:30' };

describe('usage tone', () => {
  it('goes from green to red as a limit fills up', () => {
    expect(usageHue(0)).toBe(155);
    expect(usageHue(100)).toBe(25);
    expect(usageHue(60)).toBeGreaterThan(usageHue(90));
  });
});

describe('pace', () => {
  it('measures how much of the week has passed', () => {
    expect(weekElapsed(s, now)).toBeCloseTo((4 * 24 + 8 + 10 / 60) / (7 * 24), 5);
  });

  it('projects when a limit runs out before the reset', () => {
    const p = paceOf(96, s, now);
    expect(p.ahead).toBeGreaterThan(30);
    expect(p.runsOutAt!.getTime()).toBeGreaterThan(now.getTime());
    expect(p.runsOutAt!.getTime()).toBeLessThan(new Date(2026, 9, 29, 10, 30).getTime());
  });

  it('says nothing when the current rate lasts until the reset', () => {
    expect(paceOf(30, s, now).runsOutAt).toBeNull();
    expect(paceOf(0, s, now).runsOutAt).toBeNull();
  });
});
