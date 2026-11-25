import { db, newId } from '../db';
import type { Attempt, Ingredient, Per100, Recipe, Step } from '../types';
import type { DraftAttempt, DraftRecipe } from './importer';
import { normName } from './nutrition';

const STAPLE = /^(zeytinyağı|tereyağı|sıvı yağ|ayçiçek yağı|tuz|karabiber|pul biber|kimyon|kekik|nane|su|soda|maden suyu|karbonat|kabartma tozu|tatlandırıcı|sirke|baharat)/;

/** Things that are always at home and should not count in "Dolabımda ne var?". */
export function isStapleName(ad: string): boolean {
  return STAPLE.test(normName(ad));
}

export function samePer100(a: Per100, b: Per100): boolean {
  const close = (x: number, y: number) => Math.abs(x - y) <= Math.max(0.5, Math.abs(y) * 0.02);
  return close(a.kcal, b.kcal) && close(a.protein, b.protein) && close(a.karb, b.karb) && close(a.yag, b.yag);
}

export type ResolutionStatus = 'var' | 'yeni' | 'farkli' | 'eksik';

export interface Resolution {
  key: string;
  ad: string;
  existing?: Ingredient;
  given?: Per100;
  status: ResolutionStatus;
}

/** Compares the ingredients of drafts with the library, one entry per distinct name. */
export function resolveIngredients(drafts: DraftRecipe[], lib: Ingredient[]): Resolution[] {
  const byName = new Map(lib.map((i) => [normName(i.ad), i]));
  const out = new Map<string, Resolution>();
  for (const r of drafts) {
    for (const m of r.malzemeler) {
      const key = normName(m.ad);
      if (out.has(key)) {
        const prev = out.get(key)!;
        if (!prev.given && m.per100) prev.given = m.per100;
        continue;
      }
      const existing = byName.get(key);
      let status: ResolutionStatus;
      if (existing) status = m.per100 && !samePer100(m.per100, existing) ? 'farkli' : 'var';
      else status = m.per100 ? 'yeni' : 'eksik';
      out.set(key, { key, ad: m.ad, existing, given: m.per100, status });
    }
  }
  return Array.from(out.values());
}

export interface ResolutionChoice {
  /** Values to store for a new ingredient, or to overwrite an existing one. */
  values?: Per100;
  /** For 'farkli': overwrite the library values with `values`. */
  updateLibrary?: boolean;
}

function attemptsFromDraft(recipeId: string, list: DraftAttempt[], now: number): Attempt[] {
  return list.map((d, i) => ({
    id: newId(),
    recipeId,
    tarih: d.tarih,
    puan: d.puan,
    yontem: d.yontem,
    derece: d.derece ?? null,
    sureDk: d.sureDk ?? null,
    not: d.not,
    // Undated imported attempts keep their order but get an "unknown" time.
    createdAt: d.tarih ? now - i : list.length - i
  }));
}

/** Saves imported recipes; returns the new recipe ids. */
export async function applyImport(drafts: DraftRecipe[], choices: Record<string, ResolutionChoice>): Promise<string[]> {
  const now = Date.now();
  return db.transaction('rw', db.ingredients, db.recipes, db.attempts, async () => {
    const lib = await db.ingredients.toArray();
    const byName = new Map(lib.map((i) => [normName(i.ad), i]));
    const idFor = async (ad: string, given?: Per100): Promise<string> => {
      const key = normName(ad);
      const choice = choices[key] ?? {};
      const existing = byName.get(key);
      if (existing) {
        if (choice.updateLibrary && choice.values) {
          const upd = { ...existing, ...choice.values };
          await db.ingredients.put(upd);
          byName.set(key, upd);
        }
        return existing.id;
      }
      const v = choice.values ?? given ?? { kcal: 0, protein: 0, karb: 0, yag: 0 };
      const ing: Ingredient = { id: newId(), ad: ad.trim(), ...v, temel: isStapleName(ad), createdAt: now };
      await db.ingredients.add(ing);
      byName.set(key, ing);
      return ing.id;
    };
    const ids: string[] = [];
    for (const d of drafts) {
      const malzemeler = [];
      for (const m of d.malzemeler) malzemeler.push({ ingId: await idFor(m.ad, m.per100), gram: m.gram, not: m.not });
      const recipe: Recipe = {
        id: newId(),
        ad: d.ad,
        kategori: d.kategori,
        porsiyon: d.porsiyon,
        birim: d.birim,
        birimAdet: d.birimAdet,
        sureDk: d.sureDk ?? null,
        kaynak: d.kaynak,
        etiketler: d.etiketler,
        notlar: d.notlar,
        malzemeler,
        adimlar: d.adimlar,
        createdAt: now,
        updatedAt: now
      };
      await db.recipes.add(recipe);
      await db.attempts.bulkAdd(attemptsFromDraft(recipe.id, d.denemeler, now));
      ids.push(recipe.id);
    }
    return ids;
  });
}

/** A recipe as edited in the form: ingredients by name, new ones carry their 100 g values. */
export interface EditorRecipe extends Omit<Recipe, 'id' | 'malzemeler' | 'createdAt' | 'updatedAt'> {
  malzemeler: { ingId?: string; ad: string; gram: number; not?: string; per100?: Per100 }[];
  adimlar: Step[];
}

export async function saveRecipe(id: string | null, r: EditorRecipe): Promise<string> {
  const now = Date.now();
  return db.transaction('rw', db.ingredients, db.recipes, async () => {
    const lib = await db.ingredients.toArray();
    const byName = new Map(lib.map((i) => [normName(i.ad), i]));
    const byId = new Map(lib.map((i) => [i.id, i]));
    const malzemeler = [];
    for (const m of r.malzemeler) {
      if (!m.ad.trim()) continue;
      let ing = (m.ingId && byId.get(m.ingId)) || byName.get(normName(m.ad));
      if (!ing) {
        const v = m.per100 ?? { kcal: 0, protein: 0, karb: 0, yag: 0 };
        ing = { id: newId(), ad: m.ad.trim(), ...v, temel: isStapleName(m.ad), createdAt: now };
        await db.ingredients.add(ing);
        byName.set(normName(ing.ad), ing);
        byId.set(ing.id, ing);
      }
      malzemeler.push({ ingId: ing.id, gram: m.gram, not: m.not || undefined });
    }
    const prev = id ? await db.recipes.get(id) : undefined;
    const recipe: Recipe = {
      ...r,
      id: prev?.id ?? newId(),
      malzemeler,
      adimlar: r.adimlar.filter((s) => s.metin.trim()),
      createdAt: prev?.createdAt ?? now,
      updatedAt: now
    };
    await db.recipes.put(recipe);
    return recipe.id;
  });
}

export async function deleteRecipe(id: string): Promise<void> {
  await db.transaction('rw', db.recipes, db.attempts, db.photos, async () => {
    const r = await db.recipes.get(id);
    const atts = await db.attempts.where('recipeId').equals(id).toArray();
    const photoIds = [r?.kapakFotoId, ...atts.map((a) => a.fotoId)].filter((x): x is string => !!x);
    await db.photos.bulkDelete(photoIds);
    await db.attempts.bulkDelete(atts.map((a) => a.id));
    await db.recipes.delete(id);
  });
}

export async function addAttempt(a: Omit<Attempt, 'id' | 'createdAt'>, opts: { makeDefault?: boolean } = {}): Promise<string> {
  const now = Date.now();
  const id = newId();
  await db.transaction('rw', db.attempts, db.recipes, async () => {
    if (a.enIyi) {
      const others = await db.attempts.where('recipeId').equals(a.recipeId).toArray();
      await db.attempts.bulkPut(others.map((o) => ({ ...o, enIyi: false })));
    }
    await db.attempts.add({ ...a, id, createdAt: now });
    if (opts.makeDefault && a.gramlar) {
      const r = await db.recipes.get(a.recipeId);
      if (r) {
        const g = a.gramlar;
        await db.recipes.put({ ...r, malzemeler: r.malzemeler.map((m) => (m.ingId in g ? { ...m, gram: g[m.ingId] } : m)), updatedAt: now });
      }
    }
  });
  return id;
}

export async function setBest(attempt: Attempt): Promise<void> {
  await db.transaction('rw', db.attempts, async () => {
    const all = await db.attempts.where('recipeId').equals(attempt.recipeId).toArray();
    await db.attempts.bulkPut(all.map((o) => ({ ...o, enIyi: o.id === attempt.id ? !attempt.enIyi : false })));
  });
}

/** Ingredients no recipe uses can be deleted. */
export async function ingredientUsage(): Promise<Map<string, string[]>> {
  const recipes = await db.recipes.toArray();
  const map = new Map<string, string[]>();
  for (const r of recipes) for (const m of r.malzemeler) map.set(m.ingId, [...(map.get(m.ingId) ?? []), r.id]);
  return map;
}
