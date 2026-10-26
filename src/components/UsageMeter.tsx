import type { CSSProperties, ReactNode } from 'react';
import { WEEKDAY_NAMES, formatTime } from '../lib/jalali';
import { nextReset, type Schedule } from '../lib/time';
import { paceOf, usageHue, weekElapsed } from '../lib/tone';
import { Countdown, M } from './ui';

/** Only warn when usage is clearly ahead of the week, not on a few points of noise. */
const PACE_MARGIN = 10;
const DAY = 24 * 60 * 60 * 1000;

/** CSS variable carrying the usage hue; the stylesheet derives fill, text and glow colors from it. */
export const toneStyle = (pct: number) => ({ '--tone-h': usageHue(pct).toFixed(1) }) as CSSProperties;

/**
 * A weekly limit as a bar whose color says how full it is, with a tick for how much of the week has
 * passed: a fill beyond the tick means the limit is being used faster than the week is going by.
 */
export function UsageMeter({
  label,
  icon,
  pct,
  schedule,
  now,
  warnAt,
  note,
}: {
  label: ReactNode;
  icon: ReactNode;
  pct: number;
  schedule: Schedule;
  now: Date;
  warnAt: number;
  note?: ReactNode;
}) {
  const reset = nextReset(schedule, now);
  const elapsed = weekElapsed(schedule, now);
  const pace = paceOf(pct, schedule, now);
  return (
    <div className="meter" style={toneStyle(pct)}>
      <div className="row-between">
        <span className="meter-label">
          <span className="meter-icon">{icon}</span>
          {label}
        </span>
        <span className="row baseline gap-6">
          {pct >= warnAt && <span className="tag tone">نزدیک سقف</span>}
          <M className="meter-pct">{pct}%</M>
        </span>
      </div>
      <div
        className="meter-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}% مصرف شده، ${Math.round(elapsed * 100)}% از هفته گذشته`}
      >
        <div className="meter-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        <span className="meter-tick" style={{ right: `${elapsed * 100}%` }} title={`${Math.round(elapsed * 100)}% از هفته گذشته`} />
      </div>
      <div className="row-between wrap gap-8 xsmall">
        <span className="meter-left">
          <M className="strong">{Math.max(0, 100 - pct)}%</M> مانده
        </span>
        <span className="muted">
          ریست {WEEKDAY_NAMES[reset.getDay()]} <M>{formatTime(reset)}</M> · <Countdown to={reset} now={now} />
        </span>
      </div>
      {pace.runsOutAt && pace.ahead >= PACE_MARGIN && (
        <div className={`meter-pace ${pace.runsOutAt.getTime() - now.getTime() < DAY ? 'urgent' : ''}`}>
          با این سرعت {WEEKDAY_NAMES[pace.runsOutAt.getDay()]} حدود ساعت <M>{formatTime(pace.runsOutAt)}</M> تمام می‌شود، قبل از ریست.
        </div>
      )}
      {note}
    </div>
  );
}
