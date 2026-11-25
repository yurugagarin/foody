import type { Ingredient, Per100, Recipe } from '../types';

export interface Totals extends Per100 {
  gram: number;
}

export const ZERO: Totals = { kcal: 0, protein: 0, karb: 0, yag: 0, gram: 0 };

/** Lower-case, trimmed, single-spaced Turkish name: the key for matching ingredients. */
export function normName(s: string): string {
  return s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
}

/** Values for `gram` grams of something whose 100 g values are `p`. */
export function forGrams(p: Per100, gram: number): Totals {
  const k = (Number(gram) || 0) / 100;
  return { kcal: p.kcal * k, protein: p.protein * k, karb: p.karb * k, yag: p.yag * k, gram: Number(gram) || 0 };
}

export function add(a: Totals, b: Totals): Totals {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    karb: a.karb + b.karb,
    yag: a.yag + b.yag,
    gram: a.gram + b.gram
  };
}

export function scale(t: Totals, f: number): Totals {
  return { kcal: t.kcal * f, protein: t.protein * f, karb: t.karb * f, yag: t.yag * f, gram: t.gram * f };
}

/**
 * Totals of the whole recipe. `grams` overrides the usual grams per ingredient id
 * (the "Porsiyonum" corner). Ingredients missing from the library count as zero.
 */
export function recipeTotals(
  recipe: Pick<Recipe, 'malzemeler'>,
  lib: Map<string, Ingredient>,
  grams?: Record<string, number>
): Totals {
  let t = ZERO;
  for (const ri of recipe.malzemeler) {
    const ing = lib.get(ri.ingId);
    if (!ing) continue;
    const g = grams && ri.ingId in grams ? grams[ri.ingId] : ri.gram;
    t = add(t, forGrams(ing, g));
  }
  return t;
}

/** One portion when the whole recipe is divided into `parts` portions. */
export function portionOf(t: Totals, parts: number): Totals {
  return scale(t, 1 / Math.max(1, parts || 1));
}

/** Values for one standard portion of the recipe with its usual grams. */
export function perPortion(recipe: Recipe, lib: Map<string, Ingredient>): Totals {
  return scale(recipeTotals(recipe, lib), 1 / Math.max(1, recipe.porsiyon || 1));
}

/** Turkish number: one decimal, comma separator. */
export function f1(x: number): string {
  return (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
}

export function kcal(x: number): string {
  return String(Math.round(x));
}

/** Parses "12,5" or "12.5"; empty or invalid gives NaN. */
export function parseNum(s: string | number | null | undefined): number {
  if (typeof s === 'number') return s;
  if (s == null) return NaN;
  const t = String(s).trim().replace(',', '.');
  return t === '' ? NaN : Number(t);
}
