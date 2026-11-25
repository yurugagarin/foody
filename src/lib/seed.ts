import { db } from '../db';
import seed from '../seed-data.json';
import { parseImport } from './importer';
import { applyImport } from './repo';
import { normName } from './nutrition';

interface SeedFile {
  tarifler: ({ kod?: string; ad?: string } & Record<string, unknown>)[];
}

export const SEED_KEYS = 'seedKeys';

/**
 * Adds the recipes of src/seed-data.json that this device has not received yet.
 * Each recipe is added once (tracked by its `kod`): one the user deleted does not
 * come back, and the user's own edits and ingredient values are never overwritten.
 */
export async function syncSeed(data: SeedFile = seed as SeedFile): Promise<number> {
  const done = new Set<string>(((await db.meta.get(SEED_KEYS))?.value as string[] | undefined) ?? []);
  const names = new Set((await db.recipes.toArray()).map((r) => normName(r.ad)));
  const todo = [];
  const keys: string[] = [];
  for (const raw of data.tarifler) {
    const key = raw.kod || normName(String(raw.ad ?? ''));
    keys.push(key);
    if (done.has(key)) continue;
    const draft = parseImport(JSON.stringify(raw)).recipes[0];
    if (draft && !names.has(normName(draft.ad))) todo.push(draft);
  }
  if (todo.length) await applyImport(todo, {});
  await db.meta.put({ key: SEED_KEYS, value: Array.from(new Set([...done, ...keys])) });
  return todo.length;
}
