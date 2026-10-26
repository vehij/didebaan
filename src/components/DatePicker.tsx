import { useEffect, useRef, useState } from 'react';
import {
  WEEKDAY_NAMES,
  dayOf,
  daysOfMonth,
  formatDate,
  fromYmd,
  monthTitle,
  shiftMonth,
  yearMonthOf,
  ymd,
  type CalendarKind,
  type YearMonth,
} from '../lib/jalali';
import { addMonths, daysUntil } from '../lib/time';
import { Icon } from './Icon';
import { M, Segmented } from './ui';

/** Column headers, Saturday first. */
const WEEK_HEAD = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/**
 * A date field with a calendar that switches between Jalali and Gregorian.
 * The value is always a Gregorian "YYYY-MM-DD" (or null), whatever calendar is shown.
 */
export function DatePicker({
  value,
  onChange,
  calendar,
  onCalendarChange,
  label,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  calendar: CalendarKind;
  onCalendarChange: (c: CalendarKind) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<YearMonth>(() => yearMonthOf(value ? fromYmd(value) : new Date(), calendar));
  const root = useRef<HTMLDivElement>(null);
  const today = ymd(new Date());
  const other: CalendarKind = calendar === 'jalali' ? 'gregorian' : 'jalali';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const show = (v: string | null) => setView(yearMonthOf(v ? fromYmd(v) : new Date(), calendar));

  const switchCalendar = (c: CalendarKind) => {
    onCalendarChange(c);
    setView(yearMonthOf(value ? fromYmd(value) : new Date(), c));
  };

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  const days = daysOfMonth(calendar, view);
  const lead = (days[0].getDay() + 1) % 7; // empty cells before the 1st, Saturday first
  const daysLeft = value ? daysUntil(value, new Date()) : null;

  return (
    <div className="datepicker" ref={root}>
      <button
        type="button"
        className="input date-field"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          show(value);
          setOpen((o) => !o);
        }}
      >
        <Icon name="calendar" size={17} />
        {value ? (
          <span className="grow date-field-text">
            <M className="strong">{formatDate(value, calendar)}</M>
            <M className="muted xsmall">{formatDate(value, other)}</M>
          </span>
        ) : (
          <span className="grow muted">انتخاب تاریخ</span>
        )}
        <Icon name="chevronDown" size={16} />
      </button>
      {value && daysLeft !== null && (
        <span className="xsmall muted">
          {daysLeft > 0 ? (
            <>
              <M>{daysLeft}</M> روز مانده
            </>
          ) : daysLeft === 0 ? (
            'امروز'
          ) : (
            <>
              <M>{-daysLeft}</M> روز گذشته
            </>
          )}{' '}
          · {WEEKDAY_NAMES[fromYmd(value).getDay()]}
        </span>
      )}

      {open && (
        <div
          className="popover calendar"
          role="dialog"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <div className="row-between gap-8">
            <Segmented<CalendarKind>
              label="نوع تقویم"
              value={calendar}
              onChange={switchCalendar}
              options={[
                { value: 'jalali', label: 'شمسی' },
                { value: 'gregorian', label: 'میلادی' },
              ]}
            />
            <div className="row gap-4">
              <button type="button" className="icon-btn sm" aria-label="ماه قبل" onClick={() => setView((v) => shiftMonth(v, -1))}>
                <Icon name="chevronRight" size={16} />
              </button>
              <span className="month-title">
                {monthTitle(calendar, view)} <M>{view.y}</M>
              </span>
              <button type="button" className="icon-btn sm" aria-label="ماه بعد" onClick={() => setView((v) => shiftMonth(v, 1))}>
                <Icon name="chevronLeft" size={16} />
              </button>
            </div>
          </div>

          <div className="cal-grid" role="grid">
            {WEEK_HEAD.map((d, i) => (
              <span key={d} className={`cal-head ${i === 6 ? 'weekend' : ''}`} role="columnheader">
                {d}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {days.map((d) => {
              const key = ymd(d);
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  className={`cal-day ${key === today ? 'today' : ''} ${d.getDay() === 5 ? 'weekend' : ''}`}
                  aria-selected={key === value}
                  aria-label={`${WEEKDAY_NAMES[d.getDay()]} ${formatDate(key, calendar)}`}
                  onClick={() => pick(key)}
                >
                  <M>{dayOf(d, calendar)}</M>
                  <span className="cal-other mono">{dayOf(d, other)}</span>
                </button>
              );
            })}
          </div>

          <div className="row wrap gap-6 cal-foot">
            <button type="button" className="chip-btn" onClick={() => pick(today)}>
              امروز
            </button>
            <button type="button" className="chip-btn" onClick={() => pick(addMonths(value ?? today, 1))}>
              <M>+1</M> ماه
            </button>
            {value && (
              <button type="button" className="chip-btn push-end danger-text" onClick={() => pick(null)}>
                پاک کردن
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
