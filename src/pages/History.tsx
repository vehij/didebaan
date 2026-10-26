import { useState } from 'react';
import { Select } from '../components/Select';
import { M } from '../components/ui';
import { WEEKDAY_NAMES, formatDate, formatTime, ymd } from '../lib/jalali';
import { useDb } from '../lib/store';

export function History() {
  const db = useDb();
  const [accountId, setAccountId] = useState('all');
  const names = new Map(db.accounts.map((a) => [a.id, a.label]));
  const entries = db.usage
    .filter((u) => accountId === 'all' || u.accountId === accountId)
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 300);

  return (
    <div className="page">
      <header className="page-head" data-tauri-drag-region>
        <div className="stack-2">
          <h1>تاریخچه‌ی مصرف</h1>
          <div className="muted small">هر بار که درصد مصرف را ثبت می‌کنی یا ریست هفتگی می‌رسد، اینجا می‌آید.</div>
        </div>
        <div className="row gap-8 small muted">
          اکانت
          <Select<string>
            label="اکانت"
            value={accountId}
            onChange={setAccountId}
            options={[{ value: 'all', label: 'همه' }, ...db.accounts.map((a) => ({ value: a.id, label: a.label }))]}
          />
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="card empty">
          <h2>هنوز چیزی ثبت نشده</h2>
          <p className="muted">با ذخیره‌ی درصد مصرف یک اکانت، اولین ردیف اینجا ساخته می‌شود.</p>
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="history">
            <thead>
              <tr>
                <th scope="col">زمان</th>
                <th scope="col">اکانت</th>
                <th scope="col">لیمیت کل</th>
                <th scope="col">
                  لیمیت <M>Fable</M>
                </th>
                <th scope="col">نوع</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((u) => {
                const at = new Date(u.at);
                return (
                  <tr key={u.id}>
                    <td>
                      {WEEKDAY_NAMES[at.getDay()]} <M>{formatDate(ymd(at), db.settings.calendar)}</M> <M className="muted">{formatTime(at)}</M>
                    </td>
                    <td>{names.get(u.accountId) ?? '—'}</td>
                    <td>
                      <M className="strong">{u.total}%</M>
                    </td>
                    <td>
                      <M className="strong">{u.fable}%</M>
                    </td>
                    <td>{u.source === 'reset' ? <span className="tag info">ریست خودکار</span> : <span className="tag">ثبت دستی</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
