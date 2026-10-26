import { describe, expect, it } from 'vitest';
import { addMonths, applyResets, bestAccount, daysUntil, nextReset, previousReset, splitDuration } from './time';
import { gregorianToJalali, jalaliToGregorian } from './jalali';
import { emptyDatabase, type Account } from './types';

// Monday 2026-10-26 18:40 local time.
const now = new Date(2026, 9, 26, 18, 40);

const account = (over: Partial<Account> = {}): Account => ({
  id: 'a',
  label: 'A',
  email: 'a@example.com',
  plan: 'Max 20x',
  active: true,
  deviceIds: [],
  total: { usedPct: 50, resetWeekday: 4, resetTime: '10:30', updatedAt: new Date(2026, 9, 26, 9, 0).toISOString() },
  fable: { usedPct: 70, resetWeekday: 4, resetTime: '10:30', updatedAt: new Date(2026, 9, 26, 9, 0).toISOString() },
  fableSameReset: true,
  renewalDate: '2026-11-10',
  remindDaysBefore: 3,
  note: '',
  createdAt: now.toISOString(),
  ...over,
});

describe('weekly reset schedule', () => {
  it('finds the next reset later in the same week', () => {
    expect(nextReset({ weekday: 4, time: '10:30' }, now)).toEqual(new Date(2026, 9, 29, 10, 30));
  });

  it('rolls to next week when today’s reset time has passed', () => {
    expect(nextReset({ weekday: 1, time: '09:00' }, now)).toEqual(new Date(2026, 10, 2, 9, 0));
    expect(previousReset({ weekday: 1, time: '09:00' }, now)).toEqual(new Date(2026, 9, 26, 9, 0));
  });

  it('treats a reset later today as upcoming', () => {
    expect(nextReset({ weekday: 1, time: '21:00' }, now)).toEqual(new Date(2026, 9, 26, 21, 0));
  });
});

describe('applyResets', () => {
  let n = 0;
  const id = () => `id${n++}`;

  it('keeps usage entered after the latest reset', () => {
    const db = { ...emptyDatabase(), accounts: [account()] };
    expect(applyResets(db, now, id)).toBe(db);
  });

  it('zeroes usage once the reset moment passes and logs it', () => {
    const db = { ...emptyDatabase(), accounts: [account()] };
    const after = applyResets(db, new Date(2026, 9, 29, 10, 31), id);
    expect(after.accounts[0].total.usedPct).toBe(0);
    expect(after.accounts[0].fable.usedPct).toBe(0);
    expect(after.usage).toHaveLength(1);
    expect(after.usage[0].source).toBe('reset');
  });

  it('resets the Fable limit on its own schedule', () => {
    const a = account({ fableSameReset: false, fable: { usedPct: 70, resetWeekday: 2, resetTime: '08:00', updatedAt: new Date(2026, 9, 26, 9, 0).toISOString() } });
    const after = applyResets({ ...emptyDatabase(), accounts: [a] }, new Date(2026, 9, 27, 8, 1), id);
    expect(after.accounts[0].total.usedPct).toBe(50);
    expect(after.accounts[0].fable.usedPct).toBe(0);
  });
});

describe('helpers', () => {
  it('splits durations', () => {
    expect(splitDuration((2 * 24 + 15) * 3600000 + 50 * 60000)).toEqual({ days: 2, hours: 15, minutes: 50 });
  });

  it('counts calendar days to renewal', () => {
    expect(daysUntil('2026-11-10', now)).toBe(15);
    expect(daysUntil('2026-10-20', now)).toBe(-6);
  });

  it('adds months with clamping', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-10', 1)).toBe('2026-12-10');
  });

  it('converts between Jalali and Gregorian', () => {
    expect(gregorianToJalali('2026-10-26')).toBe('1405/08/04');
    expect(jalaliToGregorian('1405/08/19')).toBe('2026-11-10');
    expect(jalaliToGregorian('۱۴۰۵/۰۸/۱۹')).toBe('2026-11-10');
    expect(jalaliToGregorian('1405/13/01')).toBeNull();
  });

  it('recommends the active account with most free room', () => {
    const a = account({ id: 'a', total: { ...account().total, usedPct: 60 } });
    const b = account({ id: 'b', total: { ...account().total, usedPct: 20 } });
    const c = account({ id: 'c', active: false, total: { ...account().total, usedPct: 0 } });
    expect(bestAccount([a, b, c], 'total', now)?.id).toBe('b');
  });
});
