import { db } from '../db';
import seed from '../seed-data.json';
import { parseImport } from './importer';
import { applyImport } from './repo';

/** On first start, loads the user's first four recipes. Runs once per device. */
export async function seedIfEmpty(): Promise<void> {
  const done = await db.meta.get('seeded');
  if (done) return;
  if ((await db.recipes.count()) === 0) {
    const { recipes } = parseImport(JSON.stringify(seed));
    await applyImport(recipes, {});
  }
  await db.meta.put({ key: 'seeded', value: Date.now() });
}
