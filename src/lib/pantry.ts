import type { Ingredient, Recipe } from '../types';

/** Ingredients that matter for "what can I cook": not staples, not zero-calorie extras. */
export function countsForPantry(ing: Ingredient | undefined): boolean {
  return !!ing && !ing.temel && ing.kcal > 0;
}

export interface PantryMatch {
  recipe: Recipe;
  need: string[];
  missing: string[];
  ratio: number;
}

export function matchPantry(recipes: Recipe[], lib: Map<string, Ingredient>, have: Set<string>): PantryMatch[] {
  return recipes
    .map((recipe) => {
      const need = Array.from(new Set(recipe.malzemeler.map((m) => m.ingId).filter((id) => countsForPantry(lib.get(id)))));
      const missing = need.filter((id) => !have.has(id));
      const ratio = need.length ? (need.length - missing.length) / need.length : 0;
      return { recipe, need, missing, ratio };
    })
    .filter((m) => m.need.length > 0);
}
