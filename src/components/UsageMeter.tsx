import type { CSSProperties, ReactNode } from 'react';
import { WEEKDAY_NAMES, formatTime } from '../lib/jalali';
import type { SessionState } from '../lib/remote';
import { nextReset, splitDuration, type Schedule } from '../lib/time';
import { paceOf, usageHue, weekElapsed } from '../lib/tone';
import { M } from './ui';

/** Only warn when usage is clearly ahead of the week, not on a few points of noise. */
const PACE_MARGIN = 10;
const DAY = 24 * 60 * 60 * 1000;

/** CSS variable carrying the usage hue; the stylesheet derives fill, text and glow colors from it. */
export const toneStyle = (pct: number) => ({ '--tone-h': usageHue(pct).toFixed(1) }) as CSSProperties;

/** Time left in its two largest units: "3 روز 4 ساعت", "2 ساعت 10 دقیقه", "12 دقیقه". */
function ShortCountdown({ to, now }: { to: Date; now: Date }) {
  const d = splitDuration(to.getTime() - now.getTime());
  if (d.days > 0) {
    return (
      <>
        <M>{d.days}</M> روز{d.hours > 0 && <> <M>{d.hours}</M> ساعت</>}
      </>
    );
  }
  if (d.hours > 0) {
    return (
      <>
        <M>{d.hours}</M> ساعت{d.minutes > 0 && <> <M>{d.minutes}</M> دقیقه</>}
      </>
    );
  }
  return (
    <>
      <M>{d.minutes}</M> دقیقه
    </>
  );
}

/**
 * One limit on two tight lines: its name, time to reset and percentage, then a bar whose color says
 * how full it is. The tick marks how much of the window has passed: a fill beyond it means the limit
 * is being used faster than time is going by.
 */
function Meter({
  label,
  pct,
  resetAt,
  elapsed,
  idleText,
  title,
  now,
  children,
}: {
  label: ReactNode;
  pct: number;
  /** Null when nothing is counting down (no session running). */
  resetAt: Date | null;
  elapsed: number;
  idleText?: string;
  title: string;
  now: Date;
  children?: ReactNode;
}) {
  return (
    <div className="meter" style={toneStyle(pct)} title={title}>
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-reset">{resetAt ? <ShortCountdown to={resetAt} now={now} /> : idleText}</span>
        <M className="meter-pct">{pct}%</M>
      </div>
      <div className="meter-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={title}>
        <div className="meter-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        {resetAt && <span className="meter-tick" style={{ right: `${elapsed * 100}%` }} />}
      </div>
      {children}
    </div>
  );
}

/** A weekly limit, with a warning line when it will run out before its reset at the current pace. */
export function UsageMeter({ label, pct, schedule, now, note }: { label: ReactNode; pct: number; schedule: Schedule; now: Date; note?: ReactNode }) {
  const reset = nextReset(schedule, now);
  const elapsed = weekElapsed(schedule, now);
  const pace = paceOf(pct, schedule, now);
  const title = `${pct}% مصرف شده، ${Math.max(0, 100 - pct)}% مانده · ریست ${WEEKDAY_NAMES[reset.getDay()]} ${formatTime(reset)} · ${Math.round(elapsed * 100)}% از هفته گذشته`;
  return (
    <Meter label={label} pct={pct} resetAt={reset} elapsed={elapsed} title={title} now={now}>
      {pace.runsOutAt && pace.ahead >= PACE_MARGIN && (
        <div className={`meter-pace ${pace.runsOutAt.getTime() - now.getTime() < DAY ? 'urgent' : ''}`}>
          با این سرعت {WEEKDAY_NAMES[pace.runsOutAt.getDay()]} <M>{formatTime(pace.runsOutAt)}</M> تمام می‌شود
        </div>
      )}
      {note}
    </Meter>
  );
}

/** The 5-hour session limit, shown only for accounts that have one. */
export function SessionMeter({ session, now }: { session: SessionState; now: Date }) {
  const title = session.resetsAt
    ? `${session.pct}% از سشن ۵ ساعته مصرف شده · ریست ساعت ${formatTime(session.resetsAt)}`
    : 'الان سشنی در جریان نیست؛ با اولین پیام شروع می‌شود';
  return <Meter label="سشن ۵ ساعته" pct={session.pct} resetAt={session.resetsAt} elapsed={session.elapsed} idleText="شروع نشده" title={title} now={now} />;
}
