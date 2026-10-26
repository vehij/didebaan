import { useEffect, useRef, useState } from 'react';
import { M } from '../components/ui';
import { Icon } from '../components/Icon';
import { ymd } from '../lib/jalali';
import { sendNotification } from '../lib/notify';
import { getDb, normalize, replaceDatabase, updateNotifySettings, updateSettings, useDb } from '../lib/store';
import { dataDir, exportBackup, isTauri } from '../lib/storage';

export function Settings() {
  const db = useDb();
  const [dir, setDir] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof normalize> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [autostart, setAutostart] = useState<boolean | null>(null);
  const desktop = isTauri();

  useEffect(() => {
    dataDir().then(setDir).catch(() => setDir(null));
    if (desktop) {
      import('@tauri-apps/plugin-autostart')
        .then((m) => m.isEnabled())
        .then(setAutostart)
        .catch(() => setAutostart(null));
    }
  }, [desktop]);

  const toggleAutostart = async (on: boolean) => {
    try {
      const m = await import('@tauri-apps/plugin-autostart');
      await (on ? m.enable() : m.disable());
      setAutostart(await m.isEnabled());
    } catch (e) {
      setMessage({ kind: 'error', text: `تنظیم اجرای خودکار نشد: ${String(e)}` });
    }
  };

  const testNotification = async () => {
    const ok = await sendNotification('دیده‌بان', 'نوتیفیکیشن‌ها درست کار می‌کنند.');
    if (!ok) setMessage({ kind: 'error', text: 'اجازه‌ی نوتیفیکیشن داده نشده. از System Settings › Notifications › Didebaan روشنش کن.' });
  };

  const doExport = async () => {
    try {
      const where = await exportBackup(JSON.stringify(getDb(), null, 2), `didebaan-backup-${ymd(new Date())}.json`);
      setMessage({ kind: 'ok', text: `پشتیبان ذخیره شد: ${where}` });
    } catch (e) {
      setMessage({ kind: 'error', text: `ذخیره‌ی پشتیبان نشد: ${String(e)}` });
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = normalize(JSON.parse(await file.text()));
      setPendingImport(parsed);
      setMessage(null);
    } catch {
      setMessage({ kind: 'error', text: 'این فایل پشتیبان معتبر دیده‌بان نیست.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="page">
      <header className="page-head" data-tauri-drag-region>
        <div className="stack-2">
          <h1>تنظیمات</h1>
        </div>
      </header>

      <section className="card settings-section">
        <h2 className="section-title">هشدارها</h2>
        <label className="row-between gap-16">
          <span className="stack-2">
            <span className="field-label">آستانه‌ی «نزدیک سقف»</span>
            <span className="muted xsmall">وقتی مصرف یک لیمیت به این درصد برسد، کارت اکانت برچسب هشدار می‌گیرد.</span>
          </span>
          <span className="row gap-6">
            <input
              className="input pct-input mono"
              dir="ltr"
              type="number"
              min={50}
              max={100}
              value={db.settings.warnAt}
              onChange={(e) => updateSettings({ warnAt: Math.max(1, Math.min(100, Number(e.target.value) || 85)) })}
            />
            <M>%</M>
          </span>
        </label>
      </section>

      <section className="card settings-section">
        <h2 className="section-title">نوتیفیکیشن‌ها</h2>
        <div className="stack-0">
          <label className="check-row">
            <input type="checkbox" checked={db.settings.notify.limit} onChange={(e) => updateNotifySettings({ limit: e.target.checked })} />
            وقتی یکی از لیمیت‌ها به آستانه‌ی «نزدیک سقف» برسد
          </label>
          <label className="check-row">
            <input type="checkbox" checked={db.settings.notify.reset} onChange={(e) => updateNotifySettings({ reset: e.target.checked })} />
            وقتی لیمیت هفتگی یک اکانت ریست شود
          </label>
          <label className="check-row">
            <input type="checkbox" checked={db.settings.notify.renewal} onChange={(e) => updateNotifySettings({ renewal: e.target.checked })} />
            یادآوری تمدید اشتراک (چند روز قبلش را در فرم هر اکانت انتخاب کن)
          </label>
        </div>
        {desktop ? (
          <div className="row">
            <button type="button" className="btn" onClick={testNotification}>
              ارسال یک نوتیفیکیشن آزمایشی
            </button>
          </div>
        ) : (
          <p className="muted xsmall">نوتیفیکیشن‌ها فقط در نسخه‌ی دسکتاپ فرستاده می‌شوند.</p>
        )}
      </section>

      {desktop && (
        <section className="card settings-section">
          <h2 className="section-title">اجرا</h2>
          <label className="check-row">
            <input type="checkbox" checked={!!autostart} disabled={autostart === null} onChange={(e) => toggleAutostart(e.target.checked)} />
            با روشن شدن مک، دیده‌بان بی‌صدا در منوبار اجرا شود
          </label>
          <p className="muted xsmall">
            بستن پنجره، اپ را نمی‌بندد؛ دیده‌بان در منوبار می‌ماند تا یادآوری‌ها برسند. برای خروج کامل از منوی آیکون منوبار «خروج» را بزن یا <M>⌘Q</M>.
          </p>
        </section>
      )}

      <section className="card settings-section">
        <h2 className="section-title">این دستگاه</h2>
        <label className="row-between gap-16">
          <span className="muted small">دیده‌بان الان روی کدام دستگاه باز است؟</span>
          <select className="input" value={db.settings.thisDeviceId ?? ''} onChange={(e) => updateSettings({ thisDeviceId: e.target.value || null })}>
            <option value="">انتخاب نشده</option>
            {db.devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card settings-section">
        <h2 className="section-title">پشتیبان‌گیری</h2>
        <p className="muted small">
          همه‌ی داده‌ها فقط روی همین مک ذخیره می‌شوند
          {dir && (
            <>
              {' '}
              در <M>{dir}</M>
            </>
          )}
          . با هر ذخیره، نسخه‌ی قبلی هم کنارش نگه داشته می‌شود.
        </p>
        <div className="row wrap gap-10">
          <button type="button" className="btn" onClick={doExport}>
            <Icon name="download" size={16} />
            ذخیره‌ی پشتیبان در Downloads
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} />
            بازگردانی از فایل پشتیبان
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {pendingImport && (
          <div className="confirm-box">
            <span>
              این فایل <M>{pendingImport.accounts.length}</M> اکانت و <M>{pendingImport.devices.length}</M> دستگاه دارد و جای همه‌ی داده‌های فعلی را می‌گیرد.
            </span>
            <div className="row gap-8">
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  replaceDatabase(pendingImport);
                  setPendingImport(null);
                  setMessage({ kind: 'ok', text: 'داده‌ها از فایل پشتیبان بازگردانی شد.' });
                }}
              >
                جایگزین کن
              </button>
              <button type="button" className="btn ghost" onClick={() => setPendingImport(null)}>
                انصراف
              </button>
            </div>
          </div>
        )}
        {message && <p className={`small ${message.kind === 'error' ? 'error' : 'ok'}`}>{message.text}</p>}
      </section>
    </div>
  );
}
