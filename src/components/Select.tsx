import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface SelectOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Small secondary text after the label, e.g. a count. */
  hint?: ReactNode;
}

/** Dropdown in Didebaan's own style, replacing the system <select>. */
export function Select<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className = '',
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  /** Accessible name; shown to screen readers only. */
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const show = () => {
    const rect = root.current?.getBoundingClientRect();
    // Open upward when there is no room for the list below the field.
    setUp(!!rect && window.innerHeight - rect.bottom < Math.min(320, options.length * 40 + 16) && rect.top > window.innerHeight - rect.bottom);
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const choose = (v: T) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === 'Escape') {
      // Keep the surrounding modal open.
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(options[active].value);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={`select ${className}`} ref={root}>
      <button
        type="button"
        className="input select-trigger"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className="grow select-value">{current?.label}</span>
        <span className={`select-chevron ${open ? 'open' : ''}`}>
          <Icon name="chevronDown" size={16} />
        </span>
      </button>
      {open && (
        <ul className={`select-list ${up ? 'up' : ''}`} id={listId} role="listbox" aria-label={label}>
          {options.map((o, i) => (
            <li
              key={String(o.value)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={i === active ? 'active' : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o.value)}
            >
              <span className="grow">{o.label}</span>
              {o.hint !== undefined && <span className="select-hint">{o.hint}</span>}
              <span className="select-check">{o.value === value && <Icon name="check" size={14} stroke={2.4} />}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
