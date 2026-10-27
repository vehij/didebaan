import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/estedad';
import '@fontsource-variable/jetbrains-mono';
import './styles.css';
import { App } from './App';
import { checkNotifications } from './lib/notify';
import { isTauri } from './lib/storage';
import { initStore } from './lib/store';
import { startSync } from './lib/sync';
import { startUpdateChecks } from './lib/updater';
import { TrayPanel } from './pages/TrayPanel';

/** Marks the page idle while its window is hidden or not in front, so looping animations pause. */
function trackIdle() {
  const update = () => document.documentElement.toggleAttribute('data-idle', document.hidden || !document.hasFocus());
  window.addEventListener('focus', update);
  window.addEventListener('blur', update);
  document.addEventListener('visibilitychange', update);
  update();
}

async function start() {
  trackIdle();
  // In a plain browser, `#tray` previews the menu bar panel during development.
  const isPanel = isTauri()
    ? (await import('@tauri-apps/api/window')).getCurrentWindow().label === 'tray'
    : location.hash === '#tray';
  if (isPanel) document.documentElement.classList.add('tray');
  // Only the dashboard window writes the data file and sends notifications.
  await initStore(isPanel ? { readOnly: true } : { onTick: checkNotifications });
  if (!isPanel) {
    startUpdateChecks();
    startSync();
  }
  createRoot(document.getElementById('root')!).render(<StrictMode>{isPanel ? <TrayPanel /> : <App />}</StrictMode>);
}

start();
