import { db } from '../db';
import type { Photo } from '../types';

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

async function dataUrlToBlob(u: string): Promise<Blob> {
  return (await fetch(u)).blob();
}

/** One file with everything, photos included: for moving between phone and computer. */
export async function exportAll(): Promise<Blob> {
  const [ingredients, recipes, attempts, photos, seedKeys] = await Promise.all([
    db.ingredients.toArray(),
    db.recipes.toArray(),
    db.attempts.toArray(),
    db.photos.toArray(),
    db.meta.get('seedKeys')
  ]);
  const ph = [];
  for (const p of photos) ph.push({ id: p.id, createdAt: p.createdAt, blob: await blobToDataUrl(p.blob), thumb: await blobToDataUrl(p.thumb) });
  const data = { app: 'foody', version: 1, exportedAt: new Date().toISOString(), ingredients, recipes, attempts, photos: ph, seedKeys: seedKeys?.value ?? [] };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

/** Replaces everything on this device with the backup. */
export async function importAll(file: File): Promise<{ recipes: number }> {
  const data = JSON.parse(await file.text());
  if (data?.app !== 'foody') throw new Error('Bu bir foody yedeği değil.');
  const photos: Photo[] = [];
  for (const p of data.photos ?? []) photos.push({ id: p.id, createdAt: p.createdAt, blob: await dataUrlToBlob(p.blob), thumb: await dataUrlToBlob(p.thumb) });
  await db.transaction('rw', [db.ingredients, db.recipes, db.attempts, db.photos, db.meta], async () => {
    await Promise.all([db.ingredients.clear(), db.recipes.clear(), db.attempts.clear(), db.photos.clear()]);
    await db.ingredients.bulkPut(data.ingredients ?? []);
    await db.recipes.bulkPut(data.recipes ?? []);
    await db.attempts.bulkPut(data.attempts ?? []);
    await db.photos.bulkPut(photos);
    await db.meta.put({ key: 'seedKeys', value: data.seedKeys ?? [] });
  });
  return { recipes: (data.recipes ?? []).length };
}
