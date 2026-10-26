import type { CSSProperties, ReactNode } from 'react';
import { formatDate, type CalendarKind } from '../lib/jalali';
import { daysUntil, limitOf, scheduleOf, type LimitKind } from '../lib/time';
import type { Account, Device } from '../lib/types';
import { Icon } from './Icon';
import { ProjectTag } from './ProjectInput';
import { Ago, M } from './ui';
import { UsageMeter, toneStyle } from './UsageMeter';

const LIMITS: { kind: LimitKind; label: ReactNode; icon: ReactNode }[] = [
  { kind: 'total', label: 'لیمیت هفتگی کل', icon: <Icon name="layers" size={14} /> },
  {
    kind: 'fable',
    label: (
      <>
        لیمیت هفتگی <M>Fable</M>
      </>
    ),
    icon: <Icon name="sparkle" size={14} />,
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

/** First letter of the account, ringed in the tone of its fuller limit so the grid reads at a glance. */
function Monogram({ label, pct }: { label: string; pct: number | null }) {
  const letter = [...label.trim()][0] ?? '؟';
  const deg = pct === null ? 0 : Math.round(Math.max(0, Math.min(100, pct)) * 3.6);
  return (
    <span
      className={`monogram ${pct === null ? 'off' : ''}`}
      style={{ ...(pct === null ? {} : toneStyle(pct)), '--deg': `${deg}deg` } as CSSProperties}
      aria-hidden="true"
    >
      <span>{letter}</span>
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
        <div className="row gap-12 min0 top-align">
          <Monogram label={account.label} pct={account.active ? Math.max(account.total.usedPct, account.fable.usedPct) : null} />
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
          <ProjectTag project={account.project} />
          </div>
        </div>
        <StatusPill active={account.active} />
      </div>

      {account.active ? (
        <div className="stack-16">
          {LIMITS.map(({ kind, label, icon }) => (
            <UsageMeter
              key={kind}
              label={label}
              icon={icon}
              pct={limitOf(account, kind).usedPct}
              schedule={scheduleOf(account, kind)}
              now={now}
              warnAt={warnAt}
              note={
                account.remote && account.remote[kind === 'total' ? 'hasWeekly' : 'hasFable'] === false ? (
                  <div className="xsmall warn-text">این عدد از افزونه نیامد؛ صفحه‌ی Usage را در Chrome همان لپ‌تاپ باز کن یا دستی واردش کن.</div>
                ) : undefined
              }
            />
          ))}
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
