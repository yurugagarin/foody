import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import seed from '../seed-data.json';
import { parseImport, draftTotals } from './importer';
import { recipeTotals, portionOf, f1 } from './nutrition';
import { stats, weight, weightedPick, sortAttempts } from './score';
import { matchPantry } from './pantry';
import { applyImport, resolveIngredients, saveRecipe, addAttempt, updateAttempt } from './repo';
import { db } from '../db';
import { syncSeed } from './seed';
import type { Ingredient } from '../types';

describe('importer', () => {
  it('reads the four seed recipes and their totals match kontrol_toplam', () => {
    const { recipes, errors, warnings } = parseImport(JSON.stringify(seed));
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(recipes.map((r) => r.ad)).toEqual([
      'Protein Brownie (Islak Kek)',
      'Lokanta Usulü Yumuşak Köfte',
      'Somonlu Makarna (Kremasız)',
      'Kolay Yoğurt Cheesecake',
      'Tavuklu Makarna (kremasız)'
    ]);
    for (const r of recipes) expect(Math.abs(draftTotals(r).kcal - r.kontrol!.kcal)).toBeLessThan(1);
    expect(recipes[1].birim).toBe('köfte');
    expect(recipes[1].birimAdet).toBe(16);
  });

  it('accepts a chat answer with text around a ```json block', () => {
    const text = 'Tabii!\n```json\n{"ad":"Test","malzemeler":[{"ad":"Un","gram":30,"her_100g":{"kcal":343,"protein":10,"karb":71,"yag":1}}]}\n```\nAfiyet olsun';
    const { recipes } = parseImport(text);
    expect(recipes[0].ad).toBe('Test');
    expect(recipes[0].malzemeler[0].gram).toBe(30);
  });

  it('warns when kontrol_toplam does not match the ingredients', () => {
    const text = JSON.stringify({ ad: 'X', malzemeler: [{ ad: 'Un', gram: 100, her_100g: { kcal: 343, protein: 10, karb: 71, yag: 1 } }], kontrol_toplam: { kcal: 500, protein: 0, karb: 0, yag: 0 } });
    expect(parseImport(text).warnings[0]).toMatch(/343 kcal/);
  });

  it('reads plain text lines like "- 60 g yulaf ezmesi"', () => {
    const { recipes, warnings } = parseImport('Kakaolu Yulaf (1 kişilik)\n- 60 g yulaf ezmesi\n- 10 g kakao\n- 1 muz\nYapılışı: 1) Yulafı pişir. 2) Kakaoyu kat.');
    const r = recipes[0];
    expect(r.ad).toBe('Kakaolu Yulaf');
    expect(r.malzemeler.map((m) => [m.ad, m.gram])).toEqual([['Yulaf ezmesi', 60], ['Kakao', 10], ['Muz', 0]]);
    expect(r.adimlar.map((s) => s.metin)).toEqual(['Yulafı pişir.', 'Kakaoyu kat.']);
    expect(warnings.length).toBe(1);
  });
});

describe('nutrition', () => {
  const lib = new Map<string, Ingredient>([
    ['k', { id: 'k', ad: 'Kıyma', kcal: 176, protein: 20, karb: 0, yag: 10, createdAt: 0 }],
    ['y', { id: 'y', ad: 'Zeytinyağı', kcal: 884, protein: 0, karb: 0, yag: 100, createdAt: 0 }]
  ]);
  const r = { porsiyon: 4, birim: 'köfte', birimAdet: 16, malzemeler: [{ ingId: 'k', gram: 500 }, { ingId: 'y', gram: 5 }] };

  it('uses the library values for any gram amount', () => {
    expect(recipeTotals(r, lib).kcal).toBeCloseTo(880 + 44.2);
    expect(recipeTotals(r, lib, { k: 250 }).kcal).toBeCloseTo(440 + 44.2);
  });

  it('divides the whole recipe into the chosen number of portions', () => {
    const whole = recipeTotals(r, lib);
    expect(f1(portionOf(whole, 2).kcal)).toBe('462,1');
    expect(portionOf(whole, 2).gram).toBe(252.5);
    expect(portionOf(whole, 0).kcal).toBeCloseTo(whole.kcal);
  });
});

describe('score', () => {
  const base = { recipeId: 'r', createdAt: 2e12 };
  it('averages only rated attempts', () => {
    const s = stats([
      { ...base, id: '1', tarih: '2026-11-01', puan: 8 },
      { ...base, id: '2', tarih: '2026-11-10', puan: 6 },
      { ...base, id: '3', tarih: null, puan: null, createdAt: 3 }
    ]);
    expect(s.avg).toBe(7);
    expect(s.count).toBe(3);
    expect(s.last).toBe(Date.parse('2026-11-10'));
    expect(s.best?.id).toBe('1');
  });

  it('keeps undated imported attempts after dated ones', () => {
    const list = sortAttempts([
      { ...base, id: 'old', tarih: null, puan: null, createdAt: 1 },
      { ...base, id: 'new', tarih: null, puan: null, createdAt: 2 },
      { ...base, id: 'dated', tarih: '2026-11-18', puan: null }
    ]);
    expect(list.map((a) => a.id)).toEqual(['dated', 'new', 'old']);
  });

  it('suggests loved and forgotten recipes more often', () => {
    expect(weight(9.5, 30)).toBeGreaterThan(weight(9.5, 1));
    expect(weight(9.5, 10)).toBeGreaterThan(weight(6, 10));
    expect(weightedPick([1, 1, 1], 0, () => 0)).toBe(1);
    expect(weightedPick([5], 0, () => 0.5)).toBe(0);
  });
});

describe('pantry', () => {
  it('ignores staples and zero-calorie extras', () => {
    const lib = new Map<string, Ingredient>([
      ['m', { id: 'm', ad: 'Makarna', kcal: 359, protein: 13, karb: 71, yag: 2, createdAt: 0 }],
      ['s', { id: 's', ad: 'Somon', kcal: 208, protein: 20, karb: 0, yag: 13, createdAt: 0 }],
      ['z', { id: 'z', ad: 'Zeytinyağı', kcal: 884, protein: 0, karb: 0, yag: 100, temel: true, createdAt: 0 }],
      ['t', { id: 't', ad: 'Tuz', kcal: 0, protein: 0, karb: 0, yag: 0, createdAt: 0 }]
    ]);
    const recipe = { id: 'r', ad: 'Somonlu', kategori: '', porsiyon: 1, etiketler: [], adimlar: [], createdAt: 0, updatedAt: 0, malzemeler: ['m', 's', 'z', 't'].map((ingId) => ({ ingId, gram: 10 })) };
    const [m] = matchPantry([recipe], lib, new Set(['m']));
    expect(m.need).toEqual(['m', 's']);
    expect(m.missing).toEqual(['s']);
    expect(m.ratio).toBe(0.5);
  });
});

describe('repo', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('stores each ingredient once and reuses it across recipes', async () => {
    const { recipes } = parseImport(JSON.stringify(seed));
    await applyImport(recipes, {});
    const ings = await db.ingredients.toArray();
    const names = ings.map((i) => i.ad);
    expect(names.filter((n) => n === 'Kakao').length).toBe(1);
    expect(names.filter((n) => n === 'Zeytinyağı').length).toBe(1);
    expect(ings.find((i) => i.ad === 'Zeytinyağı')?.temel).toBe(true);
    expect(await db.recipes.count()).toBe(5);
    expect(await db.attempts.count()).toBe(4);
    expect(names.filter((n) => n === 'Makarna').length).toBe(1);
  });

  it('flags changed and missing values when importing again', async () => {
    await applyImport(parseImport(JSON.stringify(seed)).recipes, {});
    const lib = await db.ingredients.toArray();
    const drafts = parseImport('{"ad":"Kakaolu","malzemeler":[{"ad":"kakao","gram":10,"her_100g":{"kcal":228,"protein":19.6,"karb":57.9,"yag":13.7}},{"ad":"Muz","gram":120}]}').recipes;
    const res = resolveIngredients(drafts, lib);
    expect(res.map((r) => r.status)).toEqual(['farkli', 'eksik']);
  });

  it('saves a cooking with its grams and can make them the default', async () => {
    const id = await saveRecipe(null, { ad: 'Yulaf', kategori: 'Kahvaltı', porsiyon: 1, etiketler: [], adimlar: [], malzemeler: [{ ad: 'Yulaf ezmesi', gram: 60, per100: { kcal: 389, protein: 16.9, karb: 66, yag: 6.9 } }] });
    const r = (await db.recipes.get(id))!;
    const ingId = r.malzemeler[0].ingId;
    await addAttempt({ recipeId: id, tarih: '2026-11-25', puan: 9, gramlar: { [ingId]: 80 } }, { makeDefault: true });
    expect((await db.recipes.get(id))!.malzemeler[0].gram).toBe(80);
  });
});

describe('editing an attempt', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('changes score and note, keeps the grams, and moves the "best" mark', async () => {
    const id = await saveRecipe(null, { ad: 'Yulaf', kategori: 'Kahvaltı', porsiyon: 1, etiketler: [], adimlar: [], malzemeler: [{ ad: 'Yulaf ezmesi', gram: 60, per100: { kcal: 389, protein: 16.9, karb: 66, yag: 6.9 } }] });
    const a1 = await addAttempt({ recipeId: id, tarih: '2026-11-20', puan: 9, enIyi: true, gramlar: { x: 60 } });
    const a2 = await addAttempt({ recipeId: id, tarih: '2026-11-24', puan: 6, not: 'iyi' });
    await updateAttempt(a2, { puan: 4, not: 'Limon suyu fazla geldi', enIyi: true });
    const after = await db.attempts.get(a2);
    expect(after?.puan).toBe(4);
    expect(after?.not).toBe('Limon suyu fazla geldi');
    expect((await db.attempts.get(a1))?.enIyi).toBe(false);
    expect((await db.attempts.get(a1))?.gramlar).toEqual({ x: 60 });
    expect(stats(await db.attempts.toArray()).avg).toBe(6.5);
  });
});

describe('seed sync', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('adds only recipes the device has not received, and never brings back a deleted one', async () => {
    expect(await syncSeed()).toBe(5);
    expect(await syncSeed()).toBe(0);
    const kofte = (await db.recipes.toArray()).find((r) => r.ad.startsWith('Lokanta'))!;
    await db.recipes.delete(kofte.id);
    const more = { tarifler: [...seed.tarifler, { kod: 'yeni-tarif', ad: 'Kakaolu Yulaf', malzemeler: [{ ad: 'Kakao', gram: 10, her_100g: { kcal: 300, protein: 1, karb: 1, yag: 1 } }] }] };
    expect(await syncSeed(more)).toBe(1);
    const names = (await db.recipes.toArray()).map((r) => r.ad);
    expect(names).toContain('Kakaolu Yulaf');
    expect(names.some((n) => n.startsWith('Lokanta'))).toBe(false);
    // The library keeps the existing cocoa values.
    const kakao = (await db.ingredients.toArray()).filter((i) => i.ad === 'Kakao');
    expect(kakao.length).toBe(1);
    expect(kakao[0].kcal).toBe(366);
  });
});
