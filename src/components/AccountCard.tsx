import type { CSSProperties, ReactNode } from 'react';
import { formatDate, type CalendarKind } from '../lib/jalali';
import { daysUntil, limitOf, scheduleOf, type LimitKind } from '../lib/time';
import type { Account, Device } from '../lib/types';
import { Icon } from './Icon';
import { Ago, M } from './ui';
import { sessionAt } from '../lib/remote';
import { SessionMeter, UsageMeter, toneStyle } from './UsageMeter';

const LIMITS: { kind: LimitKind; label: ReactNode }[] = [
  { kind: 'total', label: 'هفتگی کل' },
  {
    kind: 'fable',
    label: (
      <>
        هفتگی <M>Fable</M>
      </>
    ),
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
  calendar,
  onEdit,
}: {
  account: Account;
  devices: Map<string, Device>;
  now: Date;
  calendar: CalendarKind;
  onEdit: () => void;
}) {
  const remote = account.remote;
  const session = account.active ? sessionAt(remote, now) : null;
  const products = account.active ? (remote?.products ?? []).filter((p) => p.pct > 0) : [];
  const onDevices = account.deviceIds.map((id) => devices.get(id)).filter((d): d is Device => !!d);
  const fullest = Math.max(account.total.usedPct, account.fable.usedPct, session?.pct ?? 0);
  return (
    <button type="button" className={`card account-card ${account.active ? '' : 'inactive'}`} onClick={onEdit} aria-label={`ویرایش ${account.label}`}>
      <div className="account-head">
        <Monogram label={account.label} pct={account.active ? fullest : null} />
        <div className="stack-0 min0 grow">
          <div className="row gap-6 min0">
            <span className="account-name ellipsis">{account.label}</span>
            <M className="plan">{account.plan}</M>
            {!account.active && <span className="tag">غیرفعال</span>}
          </div>
          <div className="account-sub">
            {account.email && <M className="ellipsis">{account.email}</M>}
            {account.project && (
              <span className="account-project">
                <Icon name="folder" size={11} />
                {account.project}
              </span>
            )}
          </div>
        </div>
      </div>

      {account.active && (
        <div className="meters">
          {session && <SessionMeter session={session} now={now} />}
          {LIMITS.map(({ kind, label }) => (
            <UsageMeter
              key={kind}
              label={label}
              pct={limitOf(account, kind).usedPct}
              schedule={scheduleOf(account, kind)}
              now={now}
              note={
                remote && remote[kind === 'total' ? 'hasWeekly' : 'hasFable'] === false ? (
                  <div className="meter-pace" title="صفحه‌ی Usage را در Chrome همان لپ‌تاپ باز کن یا عدد را دستی وارد کن.">
                    این عدد از افزونه نیامد
                  </div>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      {products.length > 0 && (
        <div className="products" title={products.map((p) => `${p.name} ${p.pct}%`).join(' · ')}>
          <div className="products-bar" role="img" aria-label={products.map((p) => `${p.name} ${p.pct}%`).join('، ')}>
            {products.map((p) => (
              <span key={p.name} style={{ flexGrow: p.pct, background: productColor(p.name) }} />
            ))}
          </div>
          <div className="products-legend">
            {products.map((p) => (
              <span key={p.name}>
                <span className="swatch" style={{ background: productColor(p.name) }} />
                <M>{p.name}</M> <M className="ink">{p.pct}%</M>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card-foot">
        {onDevices.length > 0 && (
          <div className="row wrap gap-4">
            {onDevices.map((d) => (
              <span key={d.id} className="chip" title={d.status === 'working' ? 'در حال کار' : 'بیکار'}>
                <Icon name={d.kind} size={12} />
                <M>{d.name}</M>
                {d.status === 'working' && <span className="work-dot" aria-label="در حال کار" />}
              </span>
            ))}
          </div>
        )}
        <div className="card-meta">
          {remote ? (
            <span
              className={`synced ${now.getTime() - Date.parse(remote.capturedAt) > STALE_MS ? 'warn-text' : ''}`}
              title={`آخرین عدد خودکار${remote.device ? ` از ${remote.device}` : ''}`}
            >
              <Icon name="refresh" size={11} />
              <Ago iso={remote.capturedAt} now={now} />
            </span>
          ) : (
            <span className="synced">دستی</span>
          )}
          <span className="row gap-6" title={account.renewalDate ? `تمدید ${formatDate(account.renewalDate, calendar)}` : undefined}>
            {account.renewalDate && <M>{formatDate(account.renewalDate, calendar)}</M>}
            <RenewalPill date={account.renewalDate} now={now} ending={remote?.autoRenew === false} />
          </span>
        </div>
      </div>
    </button>
  );
}
