import { useState } from 'react';
import { StatusPill } from '../components/AccountCard';
import { Icon } from '../components/Icon';
import { ProjectInput, ProjectTag } from '../components/ProjectInput';
import { Bar, ConfirmDelete, M, Modal, Segmented } from '../components/ui';
import { allProjects, deleteDevice, newId, saveAccount, saveDevice, updateSettings, useDb } from '../lib/store';
import { ALL_PROJECTS, NO_PROJECT, deviceInProject } from '../lib/projects';
import { Select } from '../components/Select';
import type { Device, DeviceKind } from '../lib/types';

const KIND_LABEL: Record<DeviceKind, string> = { laptop: 'لپ‌تاپ', desktop: 'دسکتاپ', server: 'سرور' };

function DeviceEditor({ deviceId, onClose }: { deviceId: string | null; onClose: () => void }) {
  const db = useDb();
  const existing = deviceId ? db.devices.find((d) => d.id === deviceId) : undefined;
  const [draft, setDraft] = useState<Device>(
    () => existing ?? { id: newId(), name: '', kind: 'laptop', os: '', project: '', note: '', createdAt: new Date().toISOString() },
  );
  const [isThis, setIsThis] = useState(db.settings.thisDeviceId === draft.id);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const set = (patch: Partial<Device>) => setDraft((d) => ({ ...d, ...patch }));

  const save = () => {
    if (!draft.name.trim()) return setError('یک نام برای دستگاه بنویس.');
    saveDevice({ ...draft, name: draft.name.trim(), os: draft.os.trim(), project: draft.project.trim() });
    if (isThis) updateSettings({ thisDeviceId: draft.id });
    else if (db.settings.thisDeviceId === draft.id) updateSettings({ thisDeviceId: null });
    onClose();
  };

  return (
    <Modal
      title={existing ? 'ویرایش دستگاه' : 'دستگاه جدید'}
      onClose={onClose}
      footer={
        <>
          {existing ? (
            <ConfirmDelete
              label="حذف دستگاه"
              armed={armed}
              setArmed={setArmed}
              onConfirm={() => {
                deleteDevice(existing.id);
                onClose();
              }}
            />
          ) : (
            <span />
          )}
          <div className="row gap-10">
            {error && <span className="error small">{error}</span>}
            <button type="button" className="btn" onClick={onClose}>
              انصراف
            </button>
            <button type="button" className="btn primary" onClick={save}>
              ذخیره
            </button>
          </div>
        </>
      }
    >
      <div className="grid-2">
        <label className="field">
          <span className="field-label">نام دستگاه</span>
          <input className="input mono ltr" dir="ltr" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="MacBook Pro 16" />
        </label>
        <label className="field">
          <span className="field-label">سیستم‌عامل</span>
          <input className="input mono ltr" dir="ltr" value={draft.os} onChange={(e) => set({ os: e.target.value })} placeholder="macOS 26" />
        </label>
      </div>
      <ProjectInput value={draft.project} onChange={(project) => set({ project })} placeholder="این دستگاه برای کدام پروژه است؟ مثلاً گومان" />
      <div className="stack-6">
        <span className="field-label">نوع</span>
        <Segmented<DeviceKind>
          label="نوع دستگاه"
          value={draft.kind}
          onChange={(kind) => set({ kind })}
          options={(Object.keys(KIND_LABEL) as DeviceKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
        />
      </div>
      <label className="check-row">
        <input type="checkbox" checked={isThis} onChange={(e) => setIsThis(e.target.checked)} />
        همین دستگاهی است که الان دیده‌بان رویش باز است
      </label>
      <label className="field">
        <span className="field-label">یادداشت</span>
        <textarea className="input" rows={3} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
      </label>
    </Modal>
  );
}

export function Devices() {
  const db = useDb();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const logins = db.accounts.reduce((n, a) => n + a.deviceIds.length, 0);
  const [project, setProject] = useState(ALL_PROJECTS);
  const shown = db.devices.filter((d) => deviceInProject(d, project, db.accounts));
  const projectOptions = [
    { value: ALL_PROJECTS, label: 'همه‌ی پروژه‌ها', hint: <M>{db.devices.length}</M> },
    ...allProjects(db).map((p) => ({ value: p, label: p, hint: <M>{db.devices.filter((d) => deviceInProject(d, p, db.accounts)).length}</M> })),
    { value: NO_PROJECT, label: 'بدون پروژه', hint: <M>{db.devices.filter((d) => deviceInProject(d, NO_PROJECT, db.accounts)).length}</M> },
  ];

  const toggle = (accountId: string, deviceId: string) => {
    const a = db.accounts.find((x) => x.id === accountId);
    if (!a) return;
    const deviceIds = a.deviceIds.includes(deviceId) ? a.deviceIds.filter((x) => x !== deviceId) : [...a.deviceIds, deviceId];
    saveAccount({ ...a, deviceIds });
  };

  return (
    <div className="page">
      <header className="page-head" data-tauri-drag-region>
        <div className="stack-2">
          <h1>دستگاه‌ها</h1>
          <div className="muted small">
            <M>{db.devices.length}</M> دستگاه · <M>{logins}</M> لاگین
          </div>
        </div>
        <div className="row wrap gap-10">
          {projectOptions.length > 1 && <Select<string> label="فیلتر پروژه" value={project} onChange={setProject} options={projectOptions} className="project-filter" />}
          <button type="button" className="btn primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={17} stroke={2} />
            دستگاه جدید
          </button>
        </div>
      </header>

      {db.devices.length === 0 ? (
        <div className="card empty">
          <Icon name="laptop" size={36} stroke={1.4} />
          <h2>هنوز دستگاهی ثبت نشده</h2>
          <p className="muted">مک‌بوک، مک مینی، سرور یا هر جایی که کلاد رویش لاگین است را اضافه کن.</p>
          <button type="button" className="btn primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={17} stroke={2} />
            افزودن دستگاه
          </button>
        </div>
      ) : (
        <>
          <div className="cards">
            {shown.length === 0 && <p className="muted">دستگاهی در این پروژه نیست.</p>}
            {shown.map((d) => {
              const accounts = db.accounts.filter((a) => a.deviceIds.includes(d.id));
              return (
                <button key={d.id} type="button" className="card device-card" onClick={() => setEditing(d.id)} aria-label={`ویرایش ${d.name}`}>
                  <div className="row gap-14">
                    <div className="device-icon">
                      <Icon name={d.kind} size={24} stroke={1.6} />
                    </div>
                    <div className="stack-0 min0 grow">
                      <div className="row wrap gap-8">
                        <M className="device-name">{d.name}</M>
                        {db.settings.thisDeviceId === d.id && <span className="tag info">این دستگاه</span>}
                      </div>
                      <ProjectTag project={d.project} />
                      <span className="muted small">
                        {KIND_LABEL[d.kind]}
                        {d.os && (
                          <>
                            {' '}
                            · <M>{d.os}</M>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="stack-10">
                    <span className="muted xsmall">
                      اکانت‌های لاگین‌شده (<M>{accounts.length}</M>)
                    </span>
                    {accounts.map((a) => (
                      <div key={a.id} className="mini-account">
                        <div className="row-between">
                          <span className="small strong">{a.label}</span>
                          {a.active ? <M className="xsmall muted">{a.plan}</M> : <StatusPill active={false} />}
                        </div>
                        {a.active && (
                          <div className="grid-2 gap-12">
                            <div className="stack-4">
                              <div className="row-between xsmall muted">
                                <span>کل</span>
                                <M className="strong ink">{a.total.usedPct}%</M>
                              </div>
                              <Bar pct={a.total.usedPct} color="var(--total)" height={5} />
                            </div>
                            <div className="stack-4">
                              <div className="row-between xsmall muted">
                                <M>Fable</M>
                                <M className="strong ink">{a.fable.usedPct}%</M>
                              </div>
                              <Bar pct={a.fable.usedPct} color="var(--fable)" height={5} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {db.accounts.length > 0 && (
            <section className="stack-12">
              <div className="stack-2">
                <h2 className="section-title">نقشه‌ی لاگین‌ها</h2>
                <span className="muted small">کدام اکانت روی کدام دستگاه است. روی هر خانه بزن تا لاگین را اضافه یا حذف کنی.</span>
              </div>
              <div className="card table-wrap">
                <table className="matrix">
                  <thead>
                    <tr>
                      <th scope="col">دستگاه</th>
                      {db.accounts.map((a) => (
                        <th key={a.id} scope="col" className={a.active ? '' : 'muted'}>
                          {a.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((d) => (
                      <tr key={d.id}>
                        <th scope="row">
                          <M>{d.name}</M>
                          {d.project && <span className="muted xsmall"> · {d.project}</span>}
                        </th>
                        {db.accounts.map((a) => {
                          const on = a.deviceIds.includes(d.id);
                          return (
                            <td key={a.id}>
                              <button
                                type="button"
                                className={`cell ${on ? 'on' : ''} ${a.active ? '' : 'inactive'}`}
                                aria-pressed={on}
                                aria-label={`${a.label} روی ${d.name}`}
                                onClick={() => toggle(a.id, d.id)}
                              >
                                {on ? <Icon name="check" size={14} stroke={3} /> : <span className="dot-empty" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {editing && <DeviceEditor key={editing} deviceId={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
