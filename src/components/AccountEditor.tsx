import { useState, type ReactNode } from 'react';
import { WEEKDAY_NAMES, WEEK_ORDER, formatDate, formatTime, ymd } from '../lib/jalali';
import { deleteAccount, newId, saveAccount, updateSettings, useDb } from '../lib/store';
import { nextReset, type Schedule } from '../lib/time';
import { PLANS, type Account, type Plan, type WeeklyLimit, type Weekday } from '../lib/types';
import { DatePicker } from './DatePicker';
import { Icon } from './Icon';
import { ProjectInput } from './ProjectInput';
import { Select } from './Select';
import { TimePicker } from './TimePicker';
import { ConfirmDelete, M, Modal, Segmented } from './ui';

export function blankAccount(): Account {
  const now = new Date();
  const limit: WeeklyLimit = { usedPct: 0, resetWeekday: now.getDay() as Weekday, resetTime: formatTime(now), updatedAt: null };
  return {
    id: newId(),
    label: '',
    email: '',
    project: '',
    plan: 'Max 5x',
    active: true,
    deviceIds: [],
    total: limit,
    fable: { ...limit },
    fableSameReset: true,
    renewalDate: null,
    remindDaysBefore: 3,
    note: '',
    createdAt: now.toISOString(),
  };
}

function LimitSection({
  title,
  color,
  limit,
  warnAt,
  onChange,
  schedule,
  same,
  onSame,
  calendar,
}: {
  calendar: 'jalali' | 'gregorian';
  title: ReactNode;
  color: string;
  limit: WeeklyLimit;
  warnAt: number;
  onChange: (l: WeeklyLimit) => void;
  schedule: Schedule;
  same?: boolean;
  onSame?: (v: boolean) => void;
}) {
  const id = useState(() => newId())[0];
  const next = nextReset(schedule, new Date());
  const setPct = (v: number) => onChange({ ...limit, usedPct: Math.max(0, Math.min(100, Math.round(v) || 0)) });
  return (
    <section className="limit-section">
      <div className="row-between">
        <h3 className="row gap-8">
          <span className="swatch lg" style={{ background: color }} />
          {title}
        </h3>
        {limit.usedPct >= warnAt && <span className="tag danger">نزدیک سقف</span>}
      </div>

      <div className="stack-8">
        <div className="row-between baseline">
          <label htmlFor={`${id}-range`} className="field-label">
            میزان پر شده
          </label>
          <span className="row baseline gap-6 small muted">
            <input
              aria-label="درصد پر شده"
              className="input pct-input mono"
              dir="ltr"
              type="number"
              min={0}
              max={100}
              value={limit.usedPct}
              onChange={(e) => setPct(Number(e.target.value))}
            />
            <M>%</M> · <M>{100 - limit.usedPct}%</M> آزاد
          </span>
        </div>
        <input
          id={`${id}-range`}
          className="range"
          type="range"
          min={0}
          max={100}
          value={limit.usedPct}
          onChange={(e) => setPct(Number(e.target.value))}
          style={{ accentColor: color }}
        />
      </div>

      {onSame && (
        <label className="check-row">
          <input type="checkbox" checked={same} onChange={(e) => onSame(e.target.checked)} />
          زمان ریستش همان زمان ریست لیمیت کل است
        </label>
      )}

      {!same && (
        <div className="stack-12">
          <span className="field-label">روز ریست هفتگی</span>
          <div className="row wrap gap-6">
            {WEEK_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                className="day"
                aria-pressed={limit.resetWeekday === d}
                onClick={() => onChange({ ...limit, resetWeekday: d })}
              >
                {WEEKDAY_NAMES[d]}
              </button>
            ))}
          </div>
          <span className="field-label">ساعت ریست</span>
          <TimePicker label="ساعت ریست هفتگی" value={limit.resetTime} onChange={(resetTime) => onChange({ ...limit, resetTime })} />
        </div>
      )}

      <div className="hint">
        <Icon name="refresh" size={16} />
        <span>
          ریست بعدی: {WEEKDAY_NAMES[next.getDay()]} <M>{formatDate(ymd(next), calendar)}</M> ساعت <M>{formatTime(next)}</M> — بعد از آن درصد خودکار صفر می‌شود.
        </span>
      </div>
    </section>
  );
}

export function AccountEditor({ accountId, onClose }: { accountId: string | null; onClose: () => void }) {
  const db = useDb();
  const existing = accountId ? db.accounts.find((a) => a.id === accountId) : undefined;
  const [draft, setDraft] = useState<Account>(() => existing ?? blankAccount());
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const set = (patch: Partial<Account>) => setDraft((d) => ({ ...d, ...patch }));

  const calendar = db.settings.calendar;

  const fableSchedule: Schedule = draft.fableSameReset
    ? { weekday: draft.total.resetWeekday, time: draft.total.resetTime }
    : { weekday: draft.fable.resetWeekday, time: draft.fable.resetTime };

  const save = () => {
    if (!draft.label.trim()) return setError('یک نام نمایشی برای اکانت بنویس.');
    const fable = draft.fableSameReset ? { ...draft.fable, resetWeekday: draft.total.resetWeekday, resetTime: draft.total.resetTime } : draft.fable;
    saveAccount({ ...draft, label: draft.label.trim(), email: draft.email.trim(), project: draft.project.trim(), fable });
    onClose();
  };

  const toggleDevice = (id: string) =>
    set({ deviceIds: draft.deviceIds.includes(id) ? draft.deviceIds.filter((x) => x !== id) : [...draft.deviceIds, id] });

  const lastUpdate = existing?.total.updatedAt ? new Date(existing.total.updatedAt) : null;

  return (
    <Modal
      title={existing ? 'ویرایش اکانت' : 'اکانت جدید'}
      subtitle={
        lastUpdate ? (
          <>
            آخرین به‌روزرسانی مصرف: <M>{formatDate(ymd(lastUpdate), calendar)}</M> ساعت <M>{formatTime(lastUpdate)}</M>
          </>
        ) : undefined
      }
      onClose={onClose}
      footer={
        <>
          {existing ? (
            <ConfirmDelete
              label="حذف اکانت"
              armed={armed}
              setArmed={setArmed}
              onConfirm={() => {
                deleteAccount(existing.id);
                onClose();
              }}
            />
          ) : (
            <span />
          )}
          <div className="row gap-10">
            {error && <span className="error small">{error}</span>}
            <button type="button" className="btn" onClick={onClose}>
              انصراف
            </button>
            <button type="button" className="btn primary" onClick={save}>
              ذخیره
            </button>
          </div>
        </>
      }
    >
      <section className="stack-16">
        <h3>مشخصات</h3>
        <div className="grid-2">
          <label className="field">
            <span className="field-label">نام نمایشی</span>
            <input className="input" value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="مثلاً اکانت اصلی" />
          </label>
          <label className="field">
            <span className="field-label">ایمیل اکانت کلاد</span>
            <input className="input mono ltr" dir="ltr" type="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} placeholder="name@example.com" />
          </label>
        </div>
        <ProjectInput
          value={draft.project}
          onChange={(project) => set({ project })}
          placeholder="این اکانت درگیر چه پروژه‌ای است؟ مثلاً پروژه میرزا"
        />
        <div className="row-between wrap gap-16 end">
          <div className="stack-6">
            <span className="field-label">پلن</span>
            <Segmented<Plan> label="پلن" mono value={draft.plan} onChange={(plan) => set({ plan })} options={PLANS.map((p) => ({ value: p, label: p }))} />
          </div>
          <div className="row gap-12">
            <div className="stack-0 align-end">
              <span className="field-label">{draft.active ? 'فعال' : 'غیرفعال'}</span>
              <span className="muted xsmall">{draft.active ? 'مصرف و ریست دنبال می‌شود' : 'از پیشنهادها و آمار کنار گذاشته می‌شود'}</span>
            </div>
            <button type="button" role="switch" aria-checked={draft.active} aria-label="وضعیت اکانت" className="switch" onClick={() => set({ active: !draft.active })}>
              <span />
            </button>
          </div>
        </div>
      </section>

      <section className="stack-12">
        <div className="stack-2">
          <h3>دستگاه‌ها</h3>
          <span className="muted small">این اکانت روی کدام دستگاه‌ها لاگین است؟ چندتا را می‌توانی انتخاب کنی.</span>
        </div>
        <div className="row wrap gap-8">
          {db.devices.length === 0 && <span className="muted small">هنوز دستگاهی ثبت نکرده‌ای — از صفحه‌ی دستگاه‌ها اضافه کن.</span>}
          {db.devices.map((d) => (
            <button key={d.id} type="button" className="device-toggle" aria-pressed={draft.deviceIds.includes(d.id)} onClick={() => toggleDevice(d.id)}>
              <span className="box">
                <Icon name="check" size={12} stroke={3} />
              </span>
              <M>{d.name}</M>
            </button>
          ))}
        </div>
      </section>

      <LimitSection
        title="لیمیت هفتگی کل"
        color="var(--total)"
        limit={draft.total}
        calendar={calendar}
        warnAt={db.settings.warnAt}
        onChange={(total) => set({ total })}
        schedule={{ weekday: draft.total.resetWeekday, time: draft.total.resetTime }}
      />
      <LimitSection
        title={
          <>
            لیمیت هفتگی <M>Fable</M>
          </>
        }
        color="var(--fable)"
        limit={draft.fable}
        calendar={calendar}
        warnAt={db.settings.warnAt}
        onChange={(fable) => set({ fable })}
        schedule={fableSchedule}
        same={draft.fableSameReset}
        onSame={(fableSameReset) =>
          set({ fableSameReset, fable: fableSameReset ? draft.fable : { ...draft.fable, resetWeekday: draft.total.resetWeekday, resetTime: draft.total.resetTime } })
        }
      />

      <section className="stack-14">
        <h3>تمدید اشتراک</h3>
        <div className="grid-2">
          <div className="field">
            <span className="field-label">تاریخ تمدید</span>
            <DatePicker
              label="تاریخ تمدید"
              value={draft.renewalDate}
              onChange={(renewalDate) => set({ renewalDate })}
              calendar={calendar}
              onCalendarChange={(c) => updateSettings({ calendar: c })}
            />
          </div>
          <div className="field">
            <span className="field-label">یادآوری</span>
            <Select<number>
              label="یادآوری تمدید"
              value={draft.remindDaysBefore}
              onChange={(remindDaysBefore) => set({ remindDaysBefore })}
              options={[
                { value: 1, label: 'یک روز قبل' },
                { value: 3, label: 'سه روز قبل' },
                { value: 7, label: 'یک هفته قبل' },
                { value: 0, label: 'بدون یادآوری' },
              ]}
            />
          </div>
        </div>
        <label className="field">
          <span className="field-label">یادداشت</span>
          <textarea className="input" rows={3} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
        </label>
      </section>
    </Modal>
  );
}
