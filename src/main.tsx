import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/inter';
import './styles.css';
import { App } from './App';
import { syncSeed } from './lib/seed';
import { db } from './db';

if (navigator.storage?.persist) void navigator.storage.persist();

/** Earlier versions kept today's grams only for the session; move any left over to the device. */
async function moveSessionPlates(): Promise<void> {
  for (const key of Object.keys(sessionStorage)) {
    const m = key.match(/^foody:plate2?:(.+)$/);
    if (!m) continue;
    try {
      const v = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      if (v?.grams && !(await db.plates.get(m[1]))) await db.plates.put({ grams: v.grams, parts: v.parts, cooked: v.cooked, recipeId: m[1], updatedAt: Date.now() });
    } catch {
      /* ignore */
    }
    sessionStorage.removeItem(key);
  }
}

Promise.all([syncSeed(), moveSessionPlates()])
  .catch((e) => console.error('Yeni tarifler yüklenemedi', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
