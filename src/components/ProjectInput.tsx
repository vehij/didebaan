import { useId } from 'react';
import { allProjects, useDb } from '../lib/store';
import { Icon } from './Icon';

/** Free-text project field that suggests every project already used on an account or device. */
export function ProjectInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const db = useDb();
  const listId = useId();
  return (
    <label className="field">
      <span className="field-label">پروژه</span>
      <span className="input-icon">
        <Icon name="folder" size={17} />
        <input className="input" list={listId} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      </span>
      <datalist id={listId}>
        {allProjects(db).map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </label>
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
