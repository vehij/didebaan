import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';
import { Icon } from '../components/Icon';
import { Bar, Countdown, M } from '../components/ui';
import { WEEKDAY_NAMES, formatTime } from '../lib/jalali';
import { reloadStore, useDb } from '../lib/store';
import { bestAccount, daysUntil, limitOf, nextReset, scheduleOf, type LimitKind } from '../lib/time';
import { isTauri } from '../lib/storage';
import { useNow } from '../lib/useNow';

async function openDashboard(accountId?: string) {
  await invoke('show_main');
  if (accountId) await emit('open-account', accountId);
}

function Pick({ kind }: { kind: LimitKind }) {
  const db = useDb();
  const now = useNow();
  const a = bestAccount(db.accounts, kind, now);
  return (
    <div className={`tray-pick ${kind}`}>
      <span className="xsmall">{kind === 'total' ? 'برای کار عمومی' : <>برای <M>Fable</M></>}</span>
      <strong>{a ? a.label : '—'}</strong>
      {a && (
        <span className="xsmall">
          <M>{100 - limitOf(a, kind).usedPct}%</M> آزاد
        </span>
      )}
    </div>
  );
}

/** Small panel that drops down from the menu bar icon. */
export function TrayPanel() {
  const db = useDb();
  const now = useNow(15_000);

  useEffect(() => {
    if (!isTauri()) return;
    // The panel is hidden and shown, not reloaded, so pick up the dashboard's latest saves on every open.
    const off = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) reloadStore().catch(() => {});
    });
    return () => {
      off.then((f) => f());
    };
  }, []);

  const active = db.accounts
    .filter((a) => a.active)
    .map((a) => ({ a, at: nextReset(scheduleOf(a, 'total'), now) }))
    .sort((x, y) => x.at.getTime() - y.at.getTime());
  const inactive = db.accounts.length - active.length;
  const { warnAt } = db.settings;

  const alerts = [
    ...active.flatMap(({ a }) =>
      (['total', 'fable'] as const)
        .filter((k) => limitOf(a, k).usedPct >= warnAt)
        .map((k) => ({
          key: `${a.id}-${k}`,
          kind: 'danger' as const,
          text: (
            <>
              {a.label}: لیمیت {k === 'total' ? 'کل' : <M>Fable</M>} روی <M>{limitOf(a, k).usedPct}%</M>
            </>
          ),
        })),
    ),
    ...active
      .filter(({ a }) => a.renewalDate && daysUntil(a.renewalDate, now) >= 0 && daysUntil(a.renewalDate, now) <= Math.max(a.remindDaysBefore, 3))
      .map(({ a }) => ({
        key: `${a.id}-renew`,
        kind: 'warn' as const,
        text: (
          <>
            {a.label}: تمدید {daysUntil(a.renewalDate!, now) === 0 ? 'امروز' : <>تا <M>{daysUntil(a.renewalDate!, now)}</M> روز دیگر</>}
          </>
        ),
      })),
  ];

  return (
    <div className="tray-panel">
      <header className="tray-head">
        <div className="row gap-10">
          <div className="brand-mark sm">
            <Icon name="eye" size={17} />
          </div>
          <div className="stack-0">
            <strong>دیده‌بان</strong>
            <span className="xsmall muted">
              {WEEKDAY_NAMES[now.getDay()]} · <M>{formatTime(now)}</M>
            </span>
          </div>
        </div>
        <button type="button" className="icon-btn sm" aria-label="باز کردن داشبورد" onClick={() => openDashboard()}>
          <Icon name="grid" size={16} />
        </button>
      </header>

      {db.accounts.length === 0 ? (
        <div className="tray-empty muted small">هنوز اکانتی ثبت نشده. داشبورد را باز کن و اولین اکانت را اضافه کن.</div>
      ) : (
        <>
          <div className="tray-picks">
            <Pick kind="total" />
            <Pick kind="fable" />
          </div>

          <div className="tray-list">
            <span className="xsmall muted tray-caption">اکانت‌های فعال · به ترتیب ریست</span>
            {active.map(({ a, at }) => (
              <button key={a.id} type="button" className="tray-row" onClick={() => openDashboard(a.id)} aria-label={`ثبت مصرف ${a.label}`}>
                <div className="row-between">
                  <span className="strong small">{a.label}</span>
                  <span className="xsmall muted">
                    ریست <Countdown to={at} now={now} />
                  </span>
                </div>
                <div className="grid-2 gap-12">
                  {(['total', 'fable'] as const).map((k) => (
                    <div key={k} className="row gap-8">
                      <div className="grow">
                        <Bar pct={limitOf(a, k).usedPct} color={k === 'total' ? 'var(--total)' : 'var(--fable)'} height={5} />
                      </div>
                      <M className={`tray-pct ${limitOf(a, k).usedPct >= warnAt ? 'error' : ''}`}>{limitOf(a, k).usedPct}%</M>
                    </div>
                  ))}
                </div>
              </button>
            ))}
            <div className="row gap-14 xsmall muted tray-legend">
              <span className="row gap-6">
                <span className="swatch" style={{ background: 'var(--total)' }} />
                لیمیت کل
              </span>
              <span className="row gap-6">
                <span className="swatch" style={{ background: 'var(--fable)' }} />
                لیمیت <M>Fable</M>
              </span>
              {inactive > 0 && (
                <span className="push-end">
                  <M>{inactive}</M> اکانت غیرفعال
                </span>
              )}
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="tray-alerts">
              {alerts.slice(0, 2).map((x) => (
                <div key={x.key} className={`tray-alert ${x.kind}`}>
                  <Icon name={x.kind === 'danger' ? 'alert' : 'calendar'} size={15} />
                  <span>{x.text}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <footer className="tray-foot">
        <button type="button" className="btn primary grow" onClick={() => openDashboard()}>
          باز کردن داشبورد
        </button>
      </footer>
    </div>
  );
}
