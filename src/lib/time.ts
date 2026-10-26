import type { Account, Database, UsageEntry, WeeklyLimit, Weekday } from './types';
import { fromYmd, ymd } from './jalali';

export type LimitKind = 'total' | 'fable';

export interface Schedule {
  weekday: Weekday;
  time: string;
}

function parseTime(t: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return [0, 0];
  return [Math.min(23, Number(m[1])), Math.min(59, Number(m[2]))];
}

/** The most recent reset moment at or before `now`. */
export function previousReset(s: Schedule, now: Date): Date {
  const [h, m] = parseTime(s.time);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  d.setDate(d.getDate() - ((now.getDay() - s.weekday + 7) % 7));
  if (d > now) d.setDate(d.getDate() - 7);
  return d;
}

/** The first reset moment strictly after `now`. */
export function nextReset(s: Schedule, now: Date): Date {
  const d = previousReset(s, now);
  d.setDate(d.getDate() + 7);
  return d;
}

export function scheduleOf(account: Account, kind: LimitKind): Schedule {
  const limit = kind === 'fable' && !account.fableSameReset ? account.fable : account.total;
  return { weekday: limit.resetWeekday, time: limit.resetTime };
}

export function limitOf(account: Account, kind: LimitKind): WeeklyLimit {
  return kind === 'total' ? account.total : account.fable;
}

export interface Duration {
  days: number;
  hours: number;
  minutes: number;
}

export function splitDuration(ms: number): Duration {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  };
}

/** Whole calendar days from today to a "YYYY-MM-DD" date; negative when it has passed. */
export function daysUntil(date: string, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((fromYmd(date).getTime() - today.getTime()) / 86400000);
}

/** Adds calendar months to a "YYYY-MM-DD" date, clamping to the end of shorter months. */
export function addMonths(date: string, months: number): string {
  const d = fromYmd(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return ymd(d);
}

/**
 * Zeroes every limit whose usage was entered before its latest weekly reset,
 * and records the reset in the usage history. Returns the same object when nothing changed.
 */
export function applyResets(db: Database, now: Date, newId: () => string): Database {
  let changed = false;
  const usage: UsageEntry[] = [];
  const accounts = db.accounts.map((account) => {
    let next = account;
    for (const kind of ['total', 'fable'] as const) {
      const limit = limitOf(next, kind);
      if (!limit.updatedAt || limit.usedPct === 0) continue;
      const prev = previousReset(scheduleOf(next, kind), now);
      if (new Date(limit.updatedAt) >= prev) continue;
      next = { ...next, [kind]: { ...limit, usedPct: 0, updatedAt: prev.toISOString() } };
      changed = true;
    }
    if (next !== account) {
      usage.push({ id: newId(), accountId: account.id, at: now.toISOString(), total: next.total.usedPct, fable: next.fable.usedPct, source: 'reset' });
    }
    return next;
  });
  return changed ? { ...db, accounts, usage: [...db.usage, ...usage] } : db;
}

/** The active account with the most free room in the given limit; ties go to the sooner reset. */
export function bestAccount(accounts: Account[], kind: LimitKind, now: Date): Account | null {
  const candidates = accounts.filter((a) => a.active);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, a) => {
    const diff = limitOf(a, kind).usedPct - limitOf(best, kind).usedPct;
    if (diff !== 0) return diff < 0 ? a : best;
    return nextReset(scheduleOf(a, kind), now) < nextReset(scheduleOf(best, kind), now) ? a : best;
  });
}
