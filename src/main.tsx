import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/inter';
import './styles.css';
import { App } from './App';
import { seedIfEmpty } from './lib/seed';

if (navigator.storage?.persist) void navigator.storage.persist();

seedIfEmpty()
  .catch((e) => console.error('İlk tarifler yüklenemedi', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
