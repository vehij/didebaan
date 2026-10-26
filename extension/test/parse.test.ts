import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module shipped as-is in the extension
import { findEmail, parseUsage, parseUsagePage, planOf, resetTextToIso, skeleton } from '../parse.js';

// Monday 2026-10-26 10:00 local.
const now = new Date(2026, 9, 26, 10, 0);

describe('parseUsage', () => {
  it('reads weekly and a Fable window', () => {
    const r = parseUsage({
      five_hour: { utilization: 11, resets_at: '2026-10-26T13:20:00Z' },
      seven_day: { utilization: 79, resets_at: '2026-10-29T18:00:00Z' },
      seven_day_fable: { utilization: 75.4, resets_at: '2026-10-29T18:00:00Z' },
    });
    expect(r.weekly).toEqual({ pct: 79, resetsAt: '2026-10-29T18:00:00Z' });
    expect(r.fable?.pct).toBe(75.4);
  });

  it('falls back to another model window and reads products', () => {
    const r = parseUsage({
      seven_day: { utilization: 40, resets_at: null },
      seven_day_oauth_apps: null,
      seven_day_opus: { utilization: 20, resets_at: null },
      usage_by_product: { claude_code: 52, chat: 0, cowork: 48, other: 0 },
    });
    expect(r.fable?.pct).toBe(20);
    expect(r.products).toEqual([
      { name: 'Claude Code', pct: 52 },
      { name: 'Chats', pct: 0 },
      { name: 'Cowork', pct: 48 },
      { name: 'Other', pct: 0 },
    ]);
  });

  it('returns nulls for unknown shapes', () => {
    expect(parseUsage(null)).toEqual({ weekly: null, fable: null, products: [] });
    expect(parseUsage({ foo: 1 })).toEqual({ weekly: null, fable: null, products: [] });
  });
});

describe('page text', () => {
  it('parses the Settings › Usage page', () => {
    const lines = `Your usage
Max (20x)
Current session
Resets at 1:20 PM
11% used
This week
Resets Thursday 9:30 PM
79% used
Fable
Up to 50% of your weekly limit
Resets Thursday 9:30 PM
75% used
This week's usage by product
Claude Code
52%
Chats
0%
Cowork
48%
Other
0%`.split('\n');
    const r = parseUsagePage(lines, now);
    expect(r.weekly).toEqual({ pct: 79, resetsAt: new Date(2026, 9, 29, 21, 30).toISOString() });
    expect(r.fable?.pct).toBe(75);
    expect(r.products.map((p: { name: string }) => p.name)).toEqual(['Claude Code', 'Chats', 'Cowork', 'Other']);
  });

  it('turns reset text into the next moment', () => {
    expect(resetTextToIso('Resets Monday 9:00 AM', now)).toBe(new Date(2026, 10, 2, 9, 0).toISOString());
    expect(resetTextToIso('Resets at 1:20 PM', now)).toBe(new Date(2026, 9, 26, 13, 20).toISOString());
  });
});

describe('helpers', () => {
  it('finds emails, plans and strips personal data', () => {
    expect(findEmail({ account: { email_address: 'A@B.co' } })).toBe('a@b.co');
    expect(planOf({ rate_limit_tier: 'default_claude_max_20x' })).toBe('Max 20x');
    expect(skeleton({ name: 'Vahid', n: 3, at: '2026-10-26T10:00:00Z' })).toEqual({ name: 'string', n: 3, at: '2026-10-26T10:00:00Z' });
  });
});
