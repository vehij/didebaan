import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { allProjects, useDb } from '../lib/store';
import { Icon } from './Icon';

/**
 * Free-text project field with suggestions from every project already used on an account or a
 * device, shown in the app's own dropdown rather than the system one.
 */
export function ProjectInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const db = useDb();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const q = value.trim().toLowerCase();
  const all = allProjects(db);
  const matches = all.filter((p) => p.toLowerCase().includes(q) && p !== value.trim());
  const show = open && matches.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (p: string) => {
    onChange(p);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(matches.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && show && active >= 0) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === 'Escape' && show) {
      // Close the list, not the surrounding form.
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="field" ref={root}>
      <label className="field-label" htmlFor={id}>
        پروژه
      </label>
      <div className="combo">
        <span className="input-icon">
          <Icon name="folder" size={17} />
          <input
            id={id}
            className="input"
            role="combobox"
            aria-expanded={show}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={show && active >= 0 ? `${id}-${active}` : undefined}
            autoComplete="off"
            value={value}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
          />
          {value && (
            <button type="button" className="combo-clear" aria-label="پاک کردن پروژه" onClick={() => pick('')}>
              <Icon name="x" size={14} />
            </button>
          )}
        </span>
        {show && (
          <ul className="select-list" id={`${id}-list`} role="listbox" aria-label="پروژه‌های قبلی">
            {matches.map((p, i) => (
              <li
                key={p}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : undefined}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
              >
                <Icon name="folder" size={14} />
                <span className="grow">{p}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ProjectTag({ project }: { project: string }) {
  if (!project) return null;
  return (
    <span className="project-tag">
      <Icon name="folder" size={13} />
      {project}
    </span>
  );
}
