import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Icon } from './Icon';
import { M } from './ui';

const DAY_MINUTES = 24 * 60;
const STEP = 5;

const pad = (n: number) => String(n).padStart(2, '0');

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return ((h || 0) * 60 + (m || 0)) % DAY_MINUTES;
}

export function fromMinutes(total: number): string {
  const t = ((Math.round(total) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

/** Name of the part of the day, as people say it in Persian. */
export function partOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  if (h < 5) return 'بامداد';
  if (h < 12) return 'صبح';
  if (h < 14) return 'ظهر';
  if (h < 18) return 'بعدازظهر';
  if (h < 21) return 'عصر';
  return 'شب';
}

const QUICK = [
  { label: 'نیمه‌شب', time: '00:00' },
  { label: 'صبح', time: '09:00' },
  { label: 'ظهر', time: '12:00' },
  { label: 'عصر', time: '18:00' },
  { label: 'شب', time: '21:00' },
];

const TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

/**
 * Time of day as a sky: drag along a band that goes from night through sunrise, day and sunset,
 * then fine-tune with the hour and minute steppers. Runs right-to-left like the rest of the UI.
 */
export function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const minutes = toMinutes(value);
  const isDay = minutes >= 6 * 60 && minutes < 18 * 60;
  const set = (m: number) => onChange(fromMinutes(m));

  const fromPointer = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (rect.right - clientX) / rect.width));
    set(Math.min(DAY_MINUTES - STEP, Math.round((ratio * DAY_MINUTES) / STEP) * STEP));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    fromPointer(e.clientX);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Right-to-left: the left arrow moves later in the day.
    const delta = { ArrowLeft: STEP, ArrowUp: STEP, ArrowRight: -STEP, ArrowDown: -STEP, PageUp: 60, PageDown: -60 }[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      set(minutes + delta);
    } else if (e.key === 'Home') {
      e.preventDefault();
      set(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      set(DAY_MINUTES - STEP);
    }
  };

  return (
    <div className="timepicker">
      <div className="row-between wrap gap-12">
        <div className={`time-readout ${isDay ? 'day' : 'night'}`}>
          <span className="time-icon">
            <Icon name={isDay ? 'sun' : 'moon'} size={20} />
          </span>
          <div className="stack-0">
            <span className="xsmall muted">{partOfDay(minutes)}</span>
            <div className="row gap-4" dir="ltr">
              <div className="stepper">
                <button type="button" aria-label="یک ساعت بعد" onClick={() => set(minutes + 60)}>
                  <Icon name="chevronUp" size={14} />
                </button>
                <M className="time-digits">{pad(Math.floor(minutes / 60))}</M>
                <button type="button" aria-label="یک ساعت قبل" onClick={() => set(minutes - 60)}>
                  <Icon name="chevronDown" size={14} />
                </button>
              </div>
              <M className="time-digits colon">:</M>
              <div className="stepper">
                <button type="button" aria-label="پنج دقیقه بعد" onClick={() => set(minutes + STEP)}>
                  <Icon name="chevronUp" size={14} />
                </button>
                <M className="time-digits">{pad(minutes % 60)}</M>
                <button type="button" aria-label="پنج دقیقه قبل" onClick={() => set(minutes - STEP)}>
                  <Icon name="chevronDown" size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="row wrap gap-6">
          {QUICK.map((q) => (
            <button key={q.time} type="button" className="chip-btn" aria-pressed={value === q.time} onClick={() => onChange(q.time)}>
              {q.label} <M className="faint">{q.time}</M>
            </button>
          ))}
        </div>
      </div>

      <div
        ref={track}
        className="sky"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={DAY_MINUTES - STEP}
        aria-valuenow={minutes}
        aria-valuetext={`${partOfDay(minutes)} ${fromMinutes(minutes)}`}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && fromPointer(e.clientX)}
        onKeyDown={onKeyDown}
      >
        <div className="sky-thumb" style={{ right: `${(minutes / DAY_MINUTES) * 100}%` }}>
          <Icon name={isDay ? 'sun' : 'moon'} size={15} />
        </div>
      </div>
      <div className="sky-ticks" aria-hidden="true">
        {TICKS.map((h) => (
          <span key={h} className="mono sky-tick" dir="ltr" style={{ right: `${(h / 24) * 100}%` }}>
            {pad(h)}
          </span>
        ))}
      </div>
    </div>
  );
}
