import { formatTime } from './jalali';
import { PLANS, type Account, type Database, type Plan, type UsageEntry, type WeeklyLimit, type Weekday } from './types';

/** A report as stored by the sync server (see sync/src/report.ts). */
export interface RemoteReport {
  email: string;
  orgId: string | null;
  orgName: string | null;
  plan: string | null;
  weekly: { pct: number; resetsAt: string | null } | null;
  fable: { pct: number; resetsAt: string | null } | null;
  products: { name: string; pct: number }[];
  renewal?: { date: string; autoRenew: boolean } | null;
  device: string | null;
  capturedAt: string;
  receivedAt: string;
}

function withReading(limit: WeeklyLimit, reading: RemoteReport['weekly'], capturedAt: string): WeeklyLimit {
  // A value typed in by hand after the extension read it wins.
  if (!reading || (limit.updatedAt && limit.updatedAt >= capturedAt)) return limit;
  const next: WeeklyLimit = { ...limit, usedPct: Math.round(reading.pct), updatedAt: capturedAt };
  if (reading.resetsAt) {
    const at = new Date(reading.resetsAt);
    at.setSeconds(at.getSeconds() + 30, 0); // round to the nearest minute
    next.resetWeekday = at.getDay() as Weekday;
    next.resetTime = formatTime(at);
  }
  return next;
}

/** The newest report for each email. */
export function latestByEmail(reports: RemoteReport[]): Map<string, RemoteReport> {
  const map = new Map<string, RemoteReport>();
  for (const r of reports) {
    const key = r.email.toLowerCase();
    const prev = map.get(key);
    if (!prev || r.capturedAt > prev.capturedAt) map.set(key, r);
  }
  return map;
}

/**
 * Applies extension reports to accounts with the same email. Returns the same object when nothing changed,
 * and the emails that have reports but no matching account.
 */
export function applyRemoteReports(db: Database, reports: RemoteReport[], newId: () => string): { db: Database; unmatched: RemoteReport[] } {
  const latest = latestByEmail(reports);
  const matched = new Set<string>();
  const usage: UsageEntry[] = [];
  let changed = false;

  const accounts = db.accounts.map((a): Account => {
    const r = a.email ? latest.get(a.email.trim().toLowerCase()) : undefined;
    if (!r) return a;
    matched.add(r.email.toLowerCase());
    if (a.remote && a.remote.capturedAt >= r.capturedAt) return a;

    const total = withReading(a.total, r.weekly, r.capturedAt);
    let fable = withReading(a.fable, r.fable, r.capturedAt);
    const sameReset = fable.resetWeekday === total.resetWeekday && fable.resetTime === total.resetTime;
    const renewalFromBilling = r.renewal && (!a.renewalUpdatedAt || a.renewalUpdatedAt < r.capturedAt) ? r.renewal.date : null;
    const plan = PLANS.find((p) => p.toLowerCase() === r.plan?.toLowerCase()) as Plan | undefined;
    const next: Account = {
      ...a,
      total,
      fable,
      fableSameReset: sameReset,
      plan: plan ?? a.plan,
      renewalDate: renewalFromBilling ?? a.renewalDate,
      remote: {
        capturedAt: r.capturedAt,
        receivedAt: r.receivedAt,
        device: r.device,
        orgName: r.orgName,
        products: r.products,
        autoRenew: r.renewal ? r.renewal.autoRenew : (a.remote?.autoRenew ?? null),
      },
    };
    if (total.usedPct !== a.total.usedPct || fable.usedPct !== a.fable.usedPct) {
      usage.push({ id: newId(), accountId: a.id, at: r.capturedAt, total: total.usedPct, fable: fable.usedPct, source: 'sync' });
    }
    changed = true;
    return next;
  });

  const unmatched = [...latest.values()].filter((r) => !matched.has(r.email.toLowerCase()));
  return { db: changed ? { ...db, accounts, usage: [...db.usage, ...usage] } : db, unmatched };
}
