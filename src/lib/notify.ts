import { formatDate } from './jalali';
import { getDb, markNotified } from './store';
import { isTauri } from './storage';
import { daysUntil, limitOf, previousReset, scheduleOf } from './time';
import type { Database } from './types';

export interface Alert {
  key: string;
  title: string;
  body: string;
}

const DAY = 86_400_000;

/** Notifications that are due now and have not been shown yet. Pure, so it can be tested. */
export function dueAlerts(db: Database, now: Date): Alert[] {
  const { warnAt, notify } = db.settings;
  const seen = new Set(db.notified);
  const alerts: Alert[] = [];
  const names = new Map(db.accounts.map((a) => [a.id, a.label]));

  for (const a of db.accounts) {
    if (!a.active) continue;

    if (notify.limit) {
      for (const kind of ['total', 'fable'] as const) {
        const limit = limitOf(a, kind);
        if (limit.usedPct < warnAt) continue;
        // One warning per limit per weekly cycle.
        const cycle = previousReset(scheduleOf(a, kind), now).toISOString();
        alerts.push({
          key: `limit:${a.id}:${kind}:${cycle}`,
          title: `${a.label} نزدیک سقف است`,
          body: `لیمیت هفتگی ${kind === 'total' ? 'کل' : 'Fable'} به ${limit.usedPct}% رسیده.`,
        });
      }
    }

    if (notify.renewal && a.renewalDate && a.remindDaysBefore > 0) {
      const days = daysUntil(a.renewalDate, now);
      if (days >= 0 && days <= a.remindDaysBefore) {
        alerts.push({
          key: `renewal:${a.id}:${a.renewalDate}`,
          title: `تمدید ${a.label}`,
          body: `${days === 0 ? 'امروز' : `${days} روز دیگر`} (${formatDate(a.renewalDate, db.settings.calendar)}) موعد تمدید اشتراک است.`,
        });
      }
    }
  }

  if (notify.reset) {
    for (const u of db.usage) {
      if (u.source !== 'reset' || now.getTime() - new Date(u.at).getTime() > DAY) continue;
      const label = names.get(u.accountId);
      if (!label) continue;
      alerts.push({
        key: `reset:${u.id}`,
        title: `${label} ریست شد`,
        body: `لیمیت هفتگی دوباره آزاد است — کل ${u.total}% و Fable ${u.fable}%.`,
      });
    }
  }

  return alerts.filter((x) => !seen.has(x.key));
}

let permission: boolean | null = null;

async function canNotify(): Promise<boolean> {
  if (!isTauri()) return false;
  if (permission !== null) return permission;
  const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
  permission = (await isPermissionGranted()) || (await requestPermission()) === 'granted';
  return permission;
}

export async function sendNotification(title: string, body: string): Promise<boolean> {
  if (!(await canNotify())) return false;
  const { sendNotification: send } = await import('@tauri-apps/plugin-notification');
  send({ title, body });
  return true;
}

let running = false;

/** Shows any due notifications and remembers them. Called on the dashboard window's timer. */
export async function checkNotifications() {
  if (running) return;
  running = true;
  try {
    const alerts = dueAlerts(getDb(), new Date());
    if (alerts.length === 0 || !(await canNotify())) return;
    for (const a of alerts) await sendNotification(a.title, a.body);
    markNotified(alerts.map((a) => a.key));
  } catch (e) {
    console.error('notification check failed', e);
  } finally {
    running = false;
  }
}
