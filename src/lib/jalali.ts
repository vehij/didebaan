import { toGregorian, toJalaali, isValidJalaaliDate } from 'jalaali-js';

/** Persian weekday names indexed by Date#getDay() (0 = Sunday). */
export const WEEKDAY_NAMES = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'] as const;

/** Display order of the Iranian week, starting on Saturday. */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses a Gregorian "YYYY-MM-DD" as a local-midnight Date. */
export function fromYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function jalaliOf(d: Date): string {
  const j = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
}

/** "2026-11-10" → "1405/08/19" */
export function gregorianToJalali(s: string): string {
  return jalaliOf(fromYmd(s));
}

/** "1405/08/19" (also accepts "-" separators and Persian digits) → "2026-11-10", or null if invalid. */
export function jalaliToGregorian(input: string): string | null {
  const normalized = input
    .trim()
    .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(normalized);
  if (!m) return null;
  const [jy, jm, jd] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!isValidJalaaliDate(jy, jm, jd)) return null;
  const g = toGregorian(jy, jm, jd);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
