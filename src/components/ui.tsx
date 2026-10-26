import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { usageHue } from '../lib/tone';
import { splitDuration } from '../lib/time';
import { Icon } from './Icon';

/** Latin text and numbers: monospace, isolated left-to-right inside RTL text. */
export function M({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`mono ${className}`} dir="ltr">
      {children}
    </span>
  );
}

export function Countdown({ to, now }: { to: Date; now: Date }) {
  const d = splitDuration(to.getTime() - now.getTime());
  if (d.days > 0) {
    return (
      <>
        <M>{d.days}</M> روز و <M>{d.hours}</M> ساعت
      </>
    );
  }
  if (d.hours > 0) {
    return (
      <>
        <M>{d.hours}</M> ساعت و <M>{d.minutes}</M> دقیقه
      </>
    );
  }
  return (
    <>
      <M>{d.minutes}</M> دقیقه
    </>
  );
}

/** A thin usage bar; without an explicit color it takes the usage-level tone (green → red). */
export function Bar({ pct, color, height = 8 }: { pct: number; color?: string; height?: number }) {
  return (
    <div className="bar" style={{ height, ...(color ? {} : { '--tone-h': usageHue(pct).toFixed(1) }) } as CSSProperties}>
      <div className={`bar-fill ${color ? '' : 'toned'}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  mono,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  mono?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          className={mono ? 'mono' : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
          <button type="button" className="icon-btn" aria-label="بستن" onClick={onClose}>
            <Icon name="x" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        <footer className="modal-foot">{footer}</footer>
      </div>
    </div>
  );
}

/** A delete button that asks for confirmation inline instead of a native dialog. */
export function ConfirmDelete({ label, onConfirm, armed, setArmed }: { label: string; onConfirm: () => void; armed: boolean; setArmed: (v: boolean) => void }) {
  if (!armed) {
    return (
      <button type="button" className="btn danger-text" onClick={() => setArmed(true)}>
        <Icon name="trash" size={16} />
        {label}
      </button>
    );
  }
  return (
    <div className="confirm-row">
      <span className="small">مطمئنی؟</span>
      <button type="button" className="btn danger" onClick={onConfirm}>
        بله، حذف کن
      </button>
      <button type="button" className="btn ghost" onClick={() => setArmed(false)}>
        نه
      </button>
    </div>
  );
}

/** "۲۰ دقیقه پیش" with Latin digits. */
export function Ago({ iso, now }: { iso: string; now: Date }) {
  const min = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60000));
  if (min < 1) return <>همین الان</>;
  if (min < 60) return <><M>{min}</M> دقیقه پیش</>;
  const h = Math.round(min / 60);
  if (h < 48) return <><M>{h}</M> ساعت پیش</>;
  return <><M>{Math.round(h / 24)}</M> روز پیش</>;
}
