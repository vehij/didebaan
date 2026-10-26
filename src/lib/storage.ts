import { invoke } from '@tauri-apps/api/core';

const LOCAL_KEY = 'didebaan.db';

/** True inside the Tauri desktop shell; false when the UI runs in a plain browser (`npm run dev`). */
export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function loadRaw(): Promise<string | null> {
  if (isTauri()) return invoke<string | null>('load_db');
  try {
    return localStorage.getItem(LOCAL_KEY);
  } catch {
    return null;
  }
}

export async function saveRaw(json: string): Promise<void> {
  if (isTauri()) return invoke('save_db', { json });
  localStorage.setItem(LOCAL_KEY, json);
}

export async function dataDir(): Promise<string | null> {
  return isTauri() ? invoke<string>('data_dir') : null;
}

/** Writes a backup file: into Downloads on desktop, as a browser download otherwise. Returns where it went. */
export async function exportBackup(json: string, fileName: string): Promise<string> {
  if (isTauri()) return invoke<string>('export_backup', { json, fileName });
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return fileName;
}
