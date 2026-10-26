import { useSyncExternalStore } from 'react';
import { isTauri } from './storage';
import { flushSave } from './store';
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
    // The native side sends the notification (it keeps checking while this window is closed).
    set({ status: 'available', version: update.version, notes });
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

const HOUR = 60 * 60 * 1000;
let lastCheck = 0;

const quietCheck = () => {
  lastCheck = Date.now();
  return checkForUpdate({ silent: true });
};

/**
 * Checks shortly after launch, hourly, whenever the window comes back, and when the native side
 * (which keeps checking while the window is closed) reports a new version.
 */
export function startUpdateChecks() {
  if (!isTauri()) return;
  setTimeout(quietCheck, 5_000);
  setInterval(quietCheck, HOUR);
  window.addEventListener('focus', () => Date.now() - lastCheck > 10 * 60 * 1000 && quietCheck());
  import('@tauri-apps/api/event').then(({ listen }) => listen('update-available', () => quietCheck()));
}
