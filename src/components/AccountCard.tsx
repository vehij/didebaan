import type { ReactNode } from 'react';
import { WEEKDAY_NAMES, formatDate, type CalendarKind } from '../lib/jalali';
import { daysUntil, limitOf, nextReset, scheduleOf, type LimitKind } from '../lib/time';
import type { Account, Device } from '../lib/types';
import { Icon } from './Icon';
import { Ago, Bar, Countdown, M } from './ui';

const LIMITS: { kind: LimitKind; label: ReactNode; color: string }[] = [
  { kind: 'total', label: 'لیمیت هفتگی کل', color: 'var(--total)' },
  {
    kind: 'fable',
    label: (
      <>
        لیمیت هفتگی <M>Fable</M>
      </>
    ),
    color: 'var(--fable)',
  },
];

/** Readings older than this are flagged, since the extension sends every two hours. */
const STALE_MS = 6 * 60 * 60 * 1000;

const PRODUCT_COLORS: Record<string, string> = {
  'Claude Code': 'var(--total)',
  Cowork: '#8b5cf6',
  Chats: '#14a37f',
};

export const productColor = (name: string) => PRODUCT_COLORS[name] ?? 'var(--off-dot)';

export function RenewalPill({ date, now, ending }: { date: string | null; now: Date; ending?: boolean }) {
  if (!date) return <span className="pill">تاریخ تمدید ثبت نشده</span>;
  const days = daysUntil(date, now);
  if (days < 0) return <span className="pill danger">منقضی شده</span>;
  if (ending) {
    return (
      <span className="pill danger" title="تمدید خودکار خاموش است">
        پایان اشتراک · <M>{days}</M> روز
      </span>
    );
  }
  if (days === 0) return <span className="pill warn">امروز</span>;
  return (
    <span className={`pill ${days <= 5 ? 'warn' : ''}`}>
      <M>{days}</M> روز مانده
    </span>
  );
}

export function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`status ${active ? 'on' : 'off'}`}>
      <span className="dot" />
      {active ? 'فعال' : 'غیرفعال'}
    </span>
  );
}

export function AccountCard({
  account,
  devices,
  now,
  warnAt,
  calendar,
  onEdit,
}: {
  account: Account;
  devices: Map<string, Device>;
  now: Date;
  warnAt: number;
  calendar: CalendarKind;
  onEdit: () => void;
}) {
  return (
    <button type="button" className="card account-card" onClick={onEdit} aria-label={`ویرایش ${account.label}`}>
      <div className="row-between top">
        <div className="stack-2 min0">
          <div className="row wrap gap-8">
            <span className="account-name">{account.label}</span>
            <M className="plan">{account.plan}</M>
          </div>
          {account.email && (
            <div className="muted small">
              <M>{account.email}</M>
            </div>
          )}
          {account.project && (
            <span className="project-tag">
              <Icon name="folder" size={13} />
              {account.project}
            </span>
          )}
        </div>
        <StatusPill active={account.active} />
      </div>

      {account.active ? (
        <div className="stack-16">
          {LIMITS.map(({ kind, label, color }) => {
            const limit = limitOf(account, kind);
            const s = scheduleOf(account, kind);
            return (
              <div key={kind} className="stack-7">
                <div className="row-between">
                  <span className="limit-label">
                    <span className="swatch" style={{ background: color }} />
                    {label}
                  </span>
                  <span className="row gap-8">
                    {limit.usedPct >= warnAt && <span className="tag danger">نزدیک سقف</span>}
                    <M className="pct">{limit.usedPct}%</M>
                  </span>
                </div>
                <Bar pct={limit.usedPct} color={color} />
                <div className="muted xsmall">
                  ریست {WEEKDAY_NAMES[s.weekday]} <M>{s.time}</M> · <Countdown to={nextReset(s, now)} now={now} /> دیگر
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="inactive-box">
          <strong>این اکانت غیرفعال است</strong>
          <span>مصرف و زمان ریستش دنبال نمی‌شود.</span>
        </div>
      )}

      {account.remote && (
        <div className="remote">
          {account.active && account.remote.products.some((p) => p.pct > 0) && (
            <div className="stack-6">
              <div className="products-bar" role="img" aria-label={account.remote.products.map((p) => `${p.name} ${p.pct}%`).join('، ')}>
                {account.remote.products
                  .filter((p) => p.pct > 0)
                  .map((p) => (
                    <span key={p.name} style={{ flexGrow: p.pct, background: productColor(p.name) }} />
                  ))}
              </div>
              <div className="row wrap gap-10 xsmall muted">
                {account.remote.products
                  .filter((p) => p.pct > 0)
                  .map((p) => (
                    <span key={p.name} className="row gap-6">
                      <span className="swatch" style={{ background: productColor(p.name) }} />
                      <M>{p.name}</M> <M className="ink">{p.pct}%</M>
                    </span>
                  ))}
              </div>
            </div>
          )}
          <span className={`xsmall ${now.getTime() - Date.parse(account.remote.capturedAt) > STALE_MS ? 'warn-text' : 'muted'}`}>
            <Icon name="refresh" size={12} /> خودکار · <Ago iso={account.remote.capturedAt} now={now} />
            {account.remote.device && (
              <>
                {' '}
                از <M>{account.remote.device}</M>
              </>
            )}
          </span>
        </div>
      )}

      <div className="card-foot">
        <div className="row wrap gap-6">
          {account.deviceIds.length === 0 && <span className="muted xsmall">روی هیچ دستگاهی ثبت نشده</span>}
          {account.deviceIds
            .map((id) => devices.get(id))
            .filter((d): d is Device => !!d)
            .map((d) => (
              <span key={d.id} className="chip">
                <Icon name={d.kind} size={13} />
                <M>{d.name}</M>
              </span>
            ))}
        </div>
        <div className="row gap-8 muted xsmall">
          {account.renewalDate && (
            <span>
              تمدید <M>{formatDate(account.renewalDate, calendar)}</M>
            </span>
          )}
          <RenewalPill date={account.renewalDate} now={now} ending={account.remote?.autoRenew === false} />
        </div>
      </div>
    </button>
  );
}
