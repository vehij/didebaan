import { useSyncExternalStore } from 'react';
import { loadRaw, saveRaw } from './storage';
import { applyResets } from './time';
import { emptyDatabase, type Account, type Database, type Device, type Settings } from './types';

export const newId = () => crypto.randomUUID();

let db: Database = emptyDatabase();
let ready = false;
let saveError: string | null = null;
let loadError: string | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<void> = Promise.resolve();

function emit() {
  for (const l of listeners) l();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const json = JSON.stringify(db, null, 2);
    saving = saving
      .then(() => saveRaw(json))
      .then(() => {
        if (saveError) {
          saveError = null;
          emit();
        }
      })
      .catch((e) => {
        saveError = String(e);
        emit();
      });
  }, 250);
}

function commit(next: Database) {
  if (next === db) return;
  db = next;
  emit();
  scheduleSave();
}

/** Fills in fields added in later versions so older files keep loading. */
export function normalize(raw: unknown): Database {
  const base = emptyDatabase();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Database>;
  return {
    version: 1,
    devices: Array.isArray(r.devices) ? r.devices : [],
    accounts: Array.isArray(r.accounts) ? r.accounts : [],
    usage: Array.isArray(r.usage) ? r.usage : [],
    settings: { ...base.settings, ...(r.settings ?? {}) },
  };
}

export async function initStore() {
  try {
    const raw = await loadRaw();
    db = raw ? normalize(JSON.parse(raw)) : emptyDatabase();
  } catch (e) {
    // Never fall back to an empty database here: the next save would overwrite the user's file.
    loadError = String(e);
    emit();
    return;
  }
  ready = true;
  commit(applyResets(db, new Date(), newId));
  emit();
  setInterval(() => commit(applyResets(db, new Date(), newId)), 30_000);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDb(): Database {
  return useSyncExternalStore(subscribe, () => db);
}

export function useStoreStatus() {
  const isReady = useSyncExternalStore(subscribe, () => ready);
  const error = useSyncExternalStore(subscribe, () => saveError);
  const failedToLoad = useSyncExternalStore(subscribe, () => loadError);
  return { ready: isReady, error, loadError: failedToLoad };
}

export function getDb(): Database {
  return db;
}

export function saveAccount(account: Account) {
  const prev = db.accounts.find((a) => a.id === account.id);
  const usageChanged = !prev || prev.total.usedPct !== account.total.usedPct || prev.fable.usedPct !== account.fable.usedPct;
  const now = new Date().toISOString();
  const next: Account = usageChanged
    ? { ...account, total: { ...account.total, updatedAt: now }, fable: { ...account.fable, updatedAt: now } }
    : account;
  commit({
    ...db,
    accounts: prev ? db.accounts.map((a) => (a.id === account.id ? next : a)) : [...db.accounts, next],
    usage: usageChanged
      ? [...db.usage, { id: newId(), accountId: next.id, at: now, total: next.total.usedPct, fable: next.fable.usedPct, source: 'manual' }]
      : db.usage,
  });
}

export function deleteAccount(id: string) {
  commit({ ...db, accounts: db.accounts.filter((a) => a.id !== id), usage: db.usage.filter((u) => u.accountId !== id) });
}

export function saveDevice(device: Device) {
  const exists = db.devices.some((d) => d.id === device.id);
  commit({ ...db, devices: exists ? db.devices.map((d) => (d.id === device.id ? device : d)) : [...db.devices, device] });
}

export function deleteDevice(id: string) {
  commit({
    ...db,
    devices: db.devices.filter((d) => d.id !== id),
    accounts: db.accounts.map((a) => (a.deviceIds.includes(id) ? { ...a, deviceIds: a.deviceIds.filter((x) => x !== id) } : a)),
    settings: db.settings.thisDeviceId === id ? { ...db.settings, thisDeviceId: null } : db.settings,
  });
}

export function updateSettings(patch: Partial<Settings>) {
  commit({ ...db, settings: { ...db.settings, ...patch } });
}

export function replaceDatabase(next: Database) {
  commit(applyResets(normalize(next), new Date(), newId));
}
