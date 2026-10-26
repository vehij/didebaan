import { installUpdate, useUpdateState } from '../lib/updater';
import { Icon } from './Icon';
import { M } from './ui';

export function UpdateBanner() {
  const u = useUpdateState();
  if (u.status !== 'available' && u.status !== 'downloading') return null;
  return (
    <div className="banner update" role="status">
      <Icon name="download" size={18} />
      <div className="stack-2 grow min0">
        <strong>
          نسخه‌ی <M>{u.version}</M> دیده‌بان آماده است
        </strong>
        {u.notes && <span className="small update-notes">{u.notes}</span>}
      </div>
      {u.status === 'available' ? (
        <button type="button" className="btn primary" onClick={installUpdate}>
          به‌روزرسانی و باز کردن دوباره
        </button>
      ) : (
        <span className="small strong">
          در حال دانلود{u.progress !== null && <> · <M>{u.progress}%</M></>}…
        </span>
      )}
    </div>
  );
}
