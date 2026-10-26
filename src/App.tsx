import { useEffect, useState } from 'react';
import { AccountEditor } from './components/AccountEditor';
import { Icon, type IconName } from './components/Icon';
import { UpdateBanner } from './components/UpdateBanner';
import { M } from './components/ui';
import { isTauri } from './lib/storage';
import { useDb, useStoreStatus } from './lib/store';
import { Dashboard } from './pages/Dashboard';
import { Devices } from './pages/Devices';
import { History } from './pages/History';
import { Settings } from './pages/Settings';

type View = 'dashboard' | 'devices' | 'history' | 'settings';

export function App() {
  const db = useDb();
  const { ready, error, loadError } = useStoreStatus();
  const [view, setView] = useState<View>('dashboard');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const thisDevice = db.devices.find((d) => d.id === db.settings.thisDeviceId);

  // Rows in the menu bar panel open the account editor here.
  useEffect(() => {
    if (!isTauri()) return;
    const off = import('@tauri-apps/api/event').then(({ listen }) =>
      listen<string>('open-account', (e) => {
        setView('dashboard');
        setEditing(e.payload);
      }),
    );
    return () => {
      off.then((f) => f());
    };
  }, []);

  const nav: { id: View; label: string; icon: IconName; count?: number }[] = [
    { id: 'dashboard', label: 'داشبورد', icon: 'grid', count: db.accounts.length },
    { id: 'devices', label: 'دستگاه‌ها', icon: 'laptop', count: db.devices.length },
    { id: 'history', label: 'تاریخچه‌ی مصرف', icon: 'chart' },
    { id: 'settings', label: 'تنظیمات', icon: 'sliders' },
  ];

  if (loadError) {
    return (
      <div className="loading" role="alert">
        <strong>فایل داده‌های دیده‌بان خوانده نشد.</strong>
        <span className="muted small">برای اینکه چیزی پاک نشود، اپ چیزی ذخیره نمی‌کند. نسخه‌ی قبلی در فایل didebaan.json.bak کنار آن هست.</span>
        <M className="xsmall muted">{loadError}</M>
      </div>
    );
  }
  if (!ready) return <div className="loading">در حال بارگذاری…</div>;

  return (
    <div className="app">
      <div className="titlebar" data-tauri-drag-region />
      <aside className="sidebar">
        <div className="brand" data-tauri-drag-region>
          <div className="brand-mark">
            <Icon name="eye" size={22} />
          </div>
          <div className="stack-0">
            <span className="brand-name">دیده‌بان</span>
            <span className="muted xsmall">مدیریت اکانت‌های کلاد</span>
          </div>
        </div>
        <nav aria-label="منوی اصلی" className="nav">
          {nav.map((n) => (
            <button key={n.id} type="button" aria-current={view === n.id ? 'page' : undefined} onClick={() => setView(n.id)}>
              <Icon name={n.icon} />
              {n.label}
              {n.count !== undefined && <M className="nav-count">{n.count}</M>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="row-between gap-8">
            <span>این دستگاه</span>
            {thisDevice ? <M className="ink">{thisDevice.name}</M> : <span className="ink">—</span>}
          </div>
          <div className="row-between gap-8">
            <span>ذخیره‌سازی</span>
            <span className={error ? 'error' : 'ink'}>{error ? 'خطا در ذخیره' : 'روی همین مک'}</span>
          </div>
        </div>
      </aside>

      <main className="content">
        <UpdateBanner />
        {error && (
          <div className="banner error" role="alert">
            <Icon name="alert" size={16} />
            آخرین تغییرات ذخیره نشد: <M>{error}</M>
          </div>
        )}
        {view === 'dashboard' && <Dashboard onEdit={(id) => setEditing(id)} onNew={() => setEditing('new')} />}
        {view === 'devices' && <Devices />}
        {view === 'history' && <History />}
        {view === 'settings' && <Settings />}
      </main>

      {editing && <AccountEditor key={editing} accountId={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
