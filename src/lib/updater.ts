import { useSyncExternalStore } from 'react';
import { isTauri } from './storage';
import { flushSave, getDb, markNotified } from './store';
import type { Update } from '@tauri-apps/plugin-updater';

export type UpdateState =
  | { status: 'idle' | 'checking' | 'none' }
  | { status: 'available'; version: string; notes: string }
  | { status: 'downloading'; version: string; notes: string; progress: number | null }
  | { status: 'error'; message: string };

let state: UpdateState = { status: 'idle' };
let pending: Update | null = null;
const listeners = new Set<() => void>();

function set(next: UpdateState) {
  state = next;
  for (const l of listeners) l();
}

export function useUpdateState(): UpdateState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Release notes come with install steps after a `---` line; the app only shows what changed. */
export function whatsNew(body: string | undefined): string {
  return (body ?? '').split(/^-{3,}\s*$/m)[0].trim();
}

export async function checkForUpdate({ silent = false } = {}): Promise<void> {
  if (!isTauri() || state.status === 'checking' || state.status === 'downloading') return;
  if (!silent) set({ status: 'checking' });
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) {
      pending = null;
      if (!silent || state.status !== 'available') set({ status: 'none' });
      return;
    }
    pending = update;
    const notes = whatsNew(update.body);
    set({ status: 'available', version: update.version, notes });
    const key = `update:${update.version}`;
    if (!getDb().notified.includes(key)) {
      const { sendNotification } = await import('./notify');
      await sendNotification('نسخه‌ی جدید دیده‌بان', `نسخه‌ی ${update.version} آماده است. از داشبورد به‌روزرسانی کن.`);
      markNotified([key]);
    }
  } catch (e) {
    // A silent background check should not put an error on screen, e.g. when offline.
    if (!silent) set({ status: 'error', message: String(e) });
  }
}

export async function installUpdate(): Promise<void> {
  if (!pending || state.status !== 'available') return;
  const { version, notes } = state;
  let total = 0;
  let received = 0;
  set({ status: 'downloading', version, notes, progress: null });
  try {
    await pending.downloadAndInstall((event) => {
      if (event.event === 'Started') total = event.data.contentLength ?? 0;
      if (event.event === 'Progress') {
        received += event.data.chunkLength;
        set({ status: 'downloading', version, notes, progress: total ? Math.min(100, Math.round((received / total) * 100)) : null });
      }
    });
    await flushSave();
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  } catch (e) {
    set({ status: 'error', message: String(e) });
  }
}

const SIX_HOURS = 6 * 60 * 60 * 1000;

/** Checks shortly after launch and then every six hours while the app runs. */
export function startUpdateChecks() {
  if (!isTauri()) return;
  setTimeout(() => checkForUpdate({ silent: true }), 5_000);
  setInterval(() => checkForUpdate({ silent: true }), SIX_HOURS);
}
