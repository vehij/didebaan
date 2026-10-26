import { ymd } from './jalali';
import type { Account, Database, Device, Weekday } from './types';
import { emptyDatabase } from './types';

/** Example data so a first launch shows what the dashboard looks like. Everything here is made up. */
export function sampleDatabase(newId: () => string, now = new Date()): Database {
  const iso = now.toISOString();
  const inDays = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return ymd(d);
  };
  const device = (name: string, kind: Device['kind'], os: string, project = ''): Device => ({ id: newId(), name, kind, os, project, note: '', createdAt: iso });
  const mbp = device('MacBook Pro 16', 'laptop', 'macOS 26', 'پروژه میرزا');
  const mini = device('Mac mini M4', 'desktop', 'macOS 26');
  const air = device('MacBook Air', 'laptop', 'macOS 15');
  const imac = device('iMac 24', 'desktop', 'macOS 26', 'طراحی سایت');
  const vps = device('Ubuntu VPS', 'server', 'Ubuntu 24.04');

  const account = (
    label: string,
    email: string,
    project: string,
    plan: Account['plan'],
    deviceIds: string[],
    total: number,
    fable: number,
    weekday: Weekday,
    time: string,
    renewIn: number,
    active = true,
  ): Account => ({
    id: newId(),
    label,
    email,
    project,
    plan,
    active,
    deviceIds,
    total: { usedPct: total, resetWeekday: weekday, resetTime: time, updatedAt: iso },
    fable: { usedPct: fable, resetWeekday: weekday, resetTime: time, updatedAt: iso },
    fableSameReset: true,
    renewalDate: inDays(renewIn),
    remindDaysBefore: 3,
    note: '',
    createdAt: iso,
  });

  return {
    ...emptyDatabase(),
    devices: [mbp, mini, air, imac, vps],
    accounts: [
      account('اکانت اصلی', 'main.max@example.com', 'پروژه میرزا', 'Max 20x', [mbp.id, mini.id], 62, 81, 4, '10:30', 15),
      account('تیم طراحی', 'design.team@example.com', 'طراحی سایت', 'Team', [imac.id], 34, 12, 6, '09:00', 28),
      account('اکانت پشتیبان', 'backup.one@example.com', 'پروژه میرزا', 'Max 5x', [air.id, mini.id], 91, 97, 2, '21:00', 3),
      account('پروژه مشتری', 'client.x@example.com', 'اپ فروشگاه', 'Max 5x', [mbp.id], 18, 55, 5, '13:15', 22),
      account('تست و آزمایش', 'lab.test@example.com', '', 'Pro', [vps.id], 0, 0, 1, '12:00', -6, false),
    ],
    settings: { ...emptyDatabase().settings, thisDeviceId: mbp.id },
  };
}
