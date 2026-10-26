import { useMemo, useState } from 'react';
import { AccountCard } from '../components/AccountCard';
import { Icon } from '../components/Icon';
import { Countdown, M, Segmented } from '../components/ui';
import { WEEKDAY_NAMES, formatDate, formatTime, ymd } from '../lib/jalali';
import { allProjects, replaceDatabase, newId, useDb } from '../lib/store';
import { ALL_PROJECTS, NO_PROJECT, inProject } from '../lib/projects';
import { Select } from '../components/Select';
import { sampleDatabase } from '../lib/sample';
import { bestAccount, daysUntil, limitOf, nextReset, scheduleOf, type LimitKind } from '../lib/time';
import type { Account } from '../lib/types';
import { useNow } from '../lib/useNow';

type Filter = 'all' | 'active' | 'inactive';
type Sort = 'reset' | 'free' | 'renew' | 'name';

const RING = 2 * Math.PI * 26;

function Recommendation({ account, kind }: { account: Account | null; kind: LimitKind }) {
  const label = kind === 'total' ? 'برای کار عمومی' : (<>برای کار با <M>Fable</M></>);
  const color = kind === 'total' ? 'var(--total)' : 'var(--fable)';
  if (!account) {
    return (
      <div className="card rec">
        <div className="stack-4 grow">
          <span className="muted small">{label}</span>
          <span className="muted">اکانت فعالی وجود ندارد</span>
        </div>
      </div>
    );
  }
  const free = 100 - limitOf(account, kind).usedPct;
  const s = scheduleOf(account, kind);
  return (
    <div className="card rec">
      <div className="stack-4 grow min0">
        <span className="muted small">{label}</span>
        <span className="row wrap gap-8">
          <span className="rec-name">{account.label}</span>
          {account.project && (
            <span className="project-tag">
              <Icon name="folder" size={13} />
              {account.project}
            </span>
          )}
        </span>
        <span className="small ink-2">
          <M>{free}%</M> آزاد · ریست {WEEKDAY_NAMES[s.weekday]} <M>{s.time}</M>
        </span>
      </div>
      <svg role="img" aria-label={`${free} درصد آزاد`} width="64" height="64" viewBox="0 0 64 64" className="ring">
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--track)" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(RING * free) / 100} ${RING}`}
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="37" textAnchor="middle" className="ring-text">
          {free}
        </text>
      </svg>
    </div>
  );
}

export function Dashboard({ onEdit, onNew }: { onEdit: (id: string) => void; onNew: () => void }) {
  const db = useDb();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('reset');
  const [query, setQuery] = useState('');
  const [project, setProject] = useState(ALL_PROJECTS);

  const devices = useMemo(() => new Map(db.devices.map((d) => [d.id, d])), [db.devices]);
  const active = db.accounts.filter((a) => a.active);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const resetAt = (a: Account) => (a.active ? nextReset(scheduleOf(a, 'total'), now).getTime() : Infinity);
    const keys: Record<Exclude<Sort, 'name'>, (a: Account) => number> = {
      reset: resetAt,
      free: (a) => (a.active ? a.total.usedPct : Infinity),
      renew: (a) => (a.renewalDate ? daysUntil(a.renewalDate, now) : Infinity),
    };
    return db.accounts
      .filter((a) => filter === 'all' || (filter === 'active') === a.active)
      .filter((a) => inProject(a, project, devices))
      .filter(
        (a) =>
          !q ||
          a.label.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.project.toLowerCase().includes(q) ||
          a.deviceIds.some((id) => {
            const d = devices.get(id);
            return !!d && (d.name.toLowerCase().includes(q) || d.project.toLowerCase().includes(q));
          }),
      )
      .sort(sort === 'name' ? (x, y) => x.label.localeCompare(y.label, 'fa') : (x, y) => keys[sort](x) - keys[sort](y));
  }, [db.accounts, devices, filter, sort, query, project, now]);

  const projectOptions = [
    { value: ALL_PROJECTS, label: 'همه‌ی پروژه‌ها', hint: <M>{db.accounts.length}</M> },
    ...allProjects(db).map((p) => ({ value: p, label: p, hint: <M>{db.accounts.filter((a) => inProject(a, p, devices)).length}</M> })),
    { value: NO_PROJECT, label: 'بدون پروژه', hint: <M>{db.accounts.filter((a) => inProject(a, NO_PROJECT, devices)).length}</M> },
  ];

  const soonestReset = active
    .map((a) => ({ a, at: nextReset(scheduleOf(a, 'total'), now) }))
    .sort((x, y) => x.at.getTime() - y.at.getTime())[0];
  const soonestRenewal = active
    .filter((a) => a.renewalDate && daysUntil(a.renewalDate, now) >= 0)
    .sort((x, y) => daysUntil(x.renewalDate!, now) - daysUntil(y.renewalDate!, now))[0];
  const multiDevice = db.accounts.filter((a) => a.deviceIds.length > 1).length;
  const renewDays = soonestRenewal ? daysUntil(soonestRenewal.renewalDate!, now) : null;

  return (
    <div className="page">
      <header className="page-head" data-tauri-drag-region>
        <div className="stack-2">
          <h1>داشبورد</h1>
          <div className="muted small">
            {WEEKDAY_NAMES[now.getDay()]} · <M>{formatDate(ymd(now), db.settings.calendar)}</M> · <M>{formatTime(now)}</M>
          </div>
        </div>
        <div className="row wrap gap-10">
          <label className="search">
            <Icon name="search" size={17} />
            <span className="sr-only">جستجو</span>
            <input type="search" placeholder="جستجوی اکانت، پروژه یا دستگاه…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button type="button" className="btn primary" onClick={onNew}>
            <Icon name="plus" size={17} stroke={2} />
            اکانت جدید
          </button>
        </div>
      </header>

      {db.accounts.length === 0 ? (
        <div className="card empty">
          <Icon name="eye" size={36} stroke={1.4} />
          <h2>هنوز اکانتی ثبت نشده</h2>
          <p className="muted">اولین اکانت کلادت را اضافه کن، یا با داده‌ی نمونه ببین اپ چطور کار می‌کند.</p>
          <div className="row gap-10">
            <button type="button" className="btn primary" onClick={onNew}>
              <Icon name="plus" size={17} stroke={2} />
              افزودن اکانت
            </button>
            <button type="button" className="btn" onClick={() => replaceDatabase(sampleDatabase(newId))}>
              بارگذاری داده‌ی نمونه
            </button>
          </div>
        </div>
      ) : (
        <>
          <section aria-label="خلاصه" className="stats">
            <div className="card stat">
              <span className="muted small">اکانت‌های فعال</span>
              <div className="row baseline gap-6">
                <M className="big">{active.length}</M>
                <M className="faint">/ {db.accounts.length}</M>
              </div>
              <span className="muted xsmall">
                <M>{db.accounts.length - active.length}</M> اکانت غیرفعال
              </span>
            </div>
            <div className="card stat">
              <span className="muted small">دستگاه‌ها</span>
              <M className="big">{db.devices.length}</M>
              <span className="muted xsmall">
                <M>{multiDevice}</M> اکانت روی بیش از یک دستگاه
              </span>
            </div>
            <div className="card stat">
              <span className="muted small">نزدیک‌ترین ریست</span>
              {soonestReset ? (
                <>
                  <span className="stat-value">
                    <Countdown to={soonestReset.at} now={now} />
                  </span>
                  <span className="muted xsmall">
                    {soonestReset.a.label} · {WEEKDAY_NAMES[soonestReset.at.getDay()]} <M>{formatTime(soonestReset.at)}</M>
                  </span>
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </div>
            <div className={`card stat ${renewDays !== null && renewDays <= 5 ? 'warn' : ''}`}>
              <span className="small">نزدیک‌ترین تمدید</span>
              {soonestRenewal ? (
                <>
                  <span className="stat-value">
                    <M>{renewDays}</M> روز مانده
                  </span>
                  <span className="xsmall">
                    {soonestRenewal.label} · <M>{formatDate(soonestRenewal.renewalDate!, db.settings.calendar)}</M>
                  </span>
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </div>
          </section>

          <section className="stack-12">
            <h2 className="section-title">پیشنهاد برای همین الان</h2>
            <div className="recs">
              <Recommendation account={bestAccount(db.accounts, 'total', now)} kind="total" />
              <Recommendation account={bestAccount(db.accounts, 'fable', now)} kind="fable" />
            </div>
          </section>

          <section className="stack-14">
            <div className="row-between wrap gap-12">
              <h2 className="section-title">اکانت‌ها</h2>
              <div className="row wrap gap-10">
                <Segmented<Filter>
                  label="فیلتر وضعیت"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: <>همه <M className="count">{db.accounts.length}</M></> },
                    { value: 'active', label: <>فعال <M className="count">{active.length}</M></> },
                    { value: 'inactive', label: <>غیرفعال <M className="count">{db.accounts.length - active.length}</M></> },
                  ]}
                />
                {projectOptions.length > 1 && (
                  <Select<string> label="فیلتر پروژه" value={project} onChange={setProject} options={projectOptions} className="project-filter" />
                )}
                <div className="row gap-8 small muted">
                  مرتب‌سازی
                  <Select<Sort>
                    label="مرتب‌سازی"
                    value={sort}
                    onChange={setSort}
                    options={[
                      { value: 'reset', label: 'نزدیک‌ترین ریست' },
                      { value: 'free', label: 'بیشترین ظرفیت آزاد' },
                      { value: 'renew', label: 'نزدیک‌ترین تمدید' },
                      { value: 'name', label: 'نام' },
                    ]}
                  />
                </div>
              </div>
            </div>
            {list.length === 0 ? (
              <p className="muted">اکانتی با این فیلتر پیدا نشد.</p>
            ) : (
              <div className="cards">
                {list.map((a) => (
                  <AccountCard key={a.id} account={a} devices={devices} now={now} warnAt={db.settings.warnAt} calendar={db.settings.calendar} onEdit={() => onEdit(a.id)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
