import { describe, expect, it } from 'vitest';
import { dueAlerts } from './notify';
import { emptyDatabase, type Account, type Database } from './types';

const now = new Date(2026, 9, 26, 18, 40);

const account = (over: Partial<Account> = {}): Account => ({
  id: 'a',
  label: 'اکانت اصلی',
  email: '',
  project: '',
  plan: 'Max 20x',
  active: true,
  deviceIds: [],
  total: { usedPct: 90, resetWeekday: 4, resetTime: '10:30', updatedAt: now.toISOString() },
  fable: { usedPct: 40, resetWeekday: 4, resetTime: '10:30', updatedAt: now.toISOString() },
  fableSameReset: true,
  renewalDate: '2026-10-28',
  remindDaysBefore: 3,
  note: '',
  createdAt: now.toISOString(),
  ...over,
});

const dbWith = (over: Partial<Database>): Database => ({ ...emptyDatabase(), ...over });

describe('dueAlerts', () => {
  it('warns about a limit over the threshold and an upcoming renewal', () => {
    const keys = dueAlerts(dbWith({ accounts: [account()] }), now).map((a) => a.key);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^limit:a:total:/);
    expect(keys[1]).toBe('renewal:a:2026-10-28');
  });

  it('does not repeat notifications already shown', () => {
    const db = dbWith({ accounts: [account()] });
    const shown = dueAlerts(db, now).map((a) => a.key);
    expect(dueAlerts({ ...db, notified: shown }, now)).toEqual([]);
  });

  it('warns again in the next weekly cycle', () => {
    const db = dbWith({ accounts: [account()] });
    const shown = dueAlerts(db, now).map((a) => a.key);
    const nextWeek = new Date(2026, 9, 29, 11, 0);
    expect(dueAlerts({ ...db, notified: shown }, nextWeek).map((a) => a.key)).toHaveLength(1);
  });

  it('skips inactive accounts and respects the settings toggles', () => {
    expect(dueAlerts(dbWith({ accounts: [account({ active: false })] }), now)).toEqual([]);
    const settings = { ...emptyDatabase().settings, notify: { limit: false, reset: true, renewal: false } };
    expect(dueAlerts(dbWith({ accounts: [account()], settings }), now)).toEqual([]);
  });

  it('announces recent weekly resets only', () => {
    const usage = [
      { id: 'r1', accountId: 'a', at: new Date(2026, 9, 26, 10, 31).toISOString(), total: 0, fable: 0, source: 'reset' as const },
      { id: 'r0', accountId: 'a', at: new Date(2026, 9, 19, 10, 31).toISOString(), total: 0, fable: 0, source: 'reset' as const },
    ];
    const settings = { ...emptyDatabase().settings, notify: { limit: false, reset: true, renewal: false } };
    expect(dueAlerts(dbWith({ accounts: [account()], usage, settings }), now).map((a) => a.key)).toEqual(['reset:r1']);
  });
});
