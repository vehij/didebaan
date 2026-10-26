import { useSyncExternalStore } from 'react';
import type { RemoteReport } from './remote';
import { applyRemote, getDb, updateSettings } from './store';
import { DEFAULT_SYNC_URL, type Settings } from './types';

export interface SyncState {
  lastSyncAt: string | null;
  error: string | null;
  busy: boolean;
  /** Reports whose email matches no account yet. */
  unmatched: RemoteReport[];
}

let state: SyncState = { lastSyncAt: null, error: null, busy: false, unmatched: [] };
const listeners = new Set<() => void>();

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const syncUrl = (s: Settings) => (s.sync.url || DEFAULT_SYNC_URL).replace(/\/$/, '');

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Turns sync on with a fresh random key. */
export function enableSync() {
  updateSettings({ sync: { ...getDb().settings.sync, key: b64url(crypto.getRandomValues(new Uint8Array(32))) } });
  syncNow();
}

export function disableSync() {
  updateSettings({ sync: { ...getDb().settings.sync, key: null } });
  set({ lastSyncAt: null, error: null, unmatched: [] });
}

/** What the extension's popup asks for: the server address and the key, in one copyable string. */
export function pairingCode(s: Settings): string | null {
  if (!s.sync.key) return null;
  const json = JSON.stringify({ u: syncUrl(s), k: s.sync.key });
  return `DBN1.${b64url(new TextEncoder().encode(json))}`;
}

export async function syncNow(): Promise<void> {
  const { settings } = getDb();
  if (!settings.sync.key || state.busy) return;
  set({ busy: true });
  try {
    const res = await fetch(`${syncUrl(settings)}/v1/usage`, { headers: { Authorization: `Bearer ${settings.sync.key}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { reports } = (await res.json()) as { reports: RemoteReport[] };
    const unmatched = applyRemote(Array.isArray(reports) ? reports : []);
    set({ busy: false, error: null, lastSyncAt: new Date().toISOString(), unmatched });
  } catch (e) {
    set({ busy: false, error: String(e) });
  }
}

const EVERY = 5 * 60 * 1000;

/** Pulls reports on launch, every five minutes, and whenever the window comes back into focus. */
export function startSync() {
  syncNow();
  setInterval(syncNow, EVERY);
  window.addEventListener('focus', () => {
    if (!state.lastSyncAt || Date.now() - Date.parse(state.lastSyncAt) > 60_000) syncNow();
  });
}
