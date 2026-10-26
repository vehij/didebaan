import { describe, expect, it } from 'vitest';
import { parseReport } from './report';

const base = {
  email: 'Main.Max@Example.com',
  capturedAt: '2026-10-26T10:00:00Z',
  weekly: { pct: 79.04, resetsAt: '2026-10-29T18:00:00Z' },
  fable: { pct: 75, resetsAt: '2026-10-29T18:00:00Z' },
  products: [
    { name: 'Claude Code', pct: 52 },
    { name: 'Cowork', pct: 48 },
  ],
};

describe('parseReport', () => {
  it('normalizes a valid report', () => {
    const r = parseReport(base)!;
    expect(r.email).toBe('main.max@example.com');
    expect(r.weekly).toEqual({ pct: 79, resetsAt: '2026-10-29T18:00:00.000Z' });
    expect(r.products).toHaveLength(2);
  });

  it('rejects reports without an email, a time, or any limit', () => {
    expect(parseReport({ ...base, email: 'nope' })).toBeNull();
    expect(parseReport({ ...base, capturedAt: 'yesterday' })).toBeNull();
    expect(parseReport({ ...base, weekly: null, fable: null })).toBeNull();
    expect(parseReport('x')).toBeNull();
  });

  it('clamps percentages and drops malformed products', () => {
    const r = parseReport({ ...base, weekly: { pct: 140 }, products: [{ name: 'x' }, { pct: 3 }, 'y'] })!;
    expect(r.weekly).toEqual({ pct: 100, resetsAt: null });
    expect(r.products).toEqual([]);
  });
});
