import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/estedad';
import '@fontsource-variable/jetbrains-mono';
import './styles.css';
import { App } from './App';
import { initStore } from './lib/store';

const root = createRoot(document.getElementById('root')!);

initStore().finally(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
