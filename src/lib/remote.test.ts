import { describe, expect, it } from 'vitest';
import { applyRemoteReports, type RemoteReport } from './remote';
import { emptyDatabase, type Account } from './types';

const account = (over: Partial<Account> = {}): Account => ({
  id: 'a',
  label: 'اصلی',
  email: 'Main.Max@example.com',
  project: '',
  plan: 'Max 5x',
  active: true,
  deviceIds: [],
  total: { usedPct: 10, resetWeekday: 1, resetTime: '09:00', updatedAt: '2026-10-25T00:00:00.000Z' },
  fable: { usedPct: 5, resetWeekday: 1, resetTime: '09:00', updatedAt: '2026-10-25T00:00:00.000Z' },
  fableSameReset: true,
  renewalDate: null,
  remindDaysBefore: 3,
  note: '',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

// Thursday 2026-10-29 21:30 local, as the extension would send it.
const resets = new Date(2026, 9, 29, 21, 30).toISOString();
const report = (over: Partial<RemoteReport> = {}): RemoteReport => ({
  email: 'main.max@example.com',
  orgId: 'o',
  orgName: 'Personal',
  plan: 'Max 20x',
  weekly: { pct: 79, resetsAt: resets },
  fable: { pct: 75, resetsAt: resets },
  products: [{ name: 'Cowork', pct: 48 }],
  device: 'MacBook Air',
  capturedAt: '2026-10-26T10:00:00.000Z',
  receivedAt: '2026-10-26T10:00:01.000Z',
  ...over,
});

let n = 0;
const id = () => `u${n++}`;

describe('applyRemoteReports', () => {
  it('updates both limits, reset times, plan and products by email', () => {
    const { db, unmatched } = applyRemoteReports({ ...emptyDatabase(), accounts: [account()] }, [report()], id);
    const a = db.accounts[0];
    expect(a.total).toMatchObject({ usedPct: 79, resetWeekday: 4, resetTime: '21:30', updatedAt: '2026-10-26T10:00:00.000Z' });
    expect(a.fable.usedPct).toBe(75);
    expect(a.fableSameReset).toBe(true);
    expect(a.plan).toBe('Max 20x');
    expect(a.remote?.device).toBe('MacBook Air');
    expect(db.usage[0].source).toBe('sync');
    expect(unmatched).toEqual([]);
  });

  it('keeps the newest report and ignores ones already applied', () => {
    const first = applyRemoteReports({ ...emptyDatabase(), accounts: [account()] }, [report(), report({ capturedAt: '2026-10-26T08:00:00.000Z', weekly: { pct: 1, resetsAt: null } })], id);
    expect(first.db.accounts[0].total.usedPct).toBe(79);
    expect(applyRemoteReports(first.db, [report()], id).db).toBe(first.db);
  });

  it('does not overwrite a value typed in after the report was read', () => {
    const typed = account({ total: { usedPct: 90, resetWeekday: 1, resetTime: '09:00', updatedAt: '2026-10-26T11:00:00.000Z' } });
    const { db } = applyRemoteReports({ ...emptyDatabase(), accounts: [typed] }, [report()], id);
    expect(db.accounts[0].total.usedPct).toBe(90);
    expect(db.accounts[0].fable.usedPct).toBe(75);
  });

  it('takes the renewal date from the Billing page unless it was set by hand later', () => {
    const fromBilling = applyRemoteReports({ ...emptyDatabase(), accounts: [account({ renewalDate: '2026-11-01' })] }, [report({ renewal: { date: '2026-11-14', autoRenew: true } })], id);
    expect(fromBilling.db.accounts[0].renewalDate).toBe('2026-11-14');
    const typed = account({ renewalDate: '2026-12-01', renewalUpdatedAt: '2026-10-26T11:00:00.000Z' });
    const kept = applyRemoteReports({ ...emptyDatabase(), accounts: [typed] }, [report({ renewal: { date: '2026-11-14', autoRenew: false } })], id);
    expect(kept.db.accounts[0].renewalDate).toBe('2026-12-01');
    expect(kept.db.accounts[0].remote?.autoRenew).toBe(false);
  });

  it('lists reports with no matching account', () => {
    const { unmatched } = applyRemoteReports({ ...emptyDatabase(), accounts: [account()] }, [report({ email: 'other@example.com' })], id);
    expect(unmatched.map((r) => r.email)).toEqual(['other@example.com']);
  });
});
