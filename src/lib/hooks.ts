import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import type { Attempt, Ingredient, Plate, Recipe } from '../types';
import { stats, type Stats } from './score';

/**
 * "Back" that always lands somewhere sensible: the previous screen inside the
 * app, or `fallback` when the app was opened directly on this screen.
 */
export function useGoBack(): (fallback: string) => void {
  const nav = useNavigate();
  return useCallback(
    (fallback: string) => {
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0) nav(-1);
      else nav(fallback, { replace: true });
    },
    [nav]
  );
}

export function useLibrary(): Map<string, Ingredient> | undefined {
  return useLiveQuery(async () => new Map((await db.ingredients.toArray()).map((i) => [i.id, i])), []);
}

export interface RecipeWithStats {
  recipe: Recipe;
  attempts: Attempt[];
  stats: Stats;
}

export function useRecipes(): RecipeWithStats[] | undefined {
  return useLiveQuery(async () => {
    const [recipes, attempts] = await Promise.all([db.recipes.toArray(), db.attempts.toArray()]);
    const by = new Map<string, Attempt[]>();
    for (const a of attempts) by.set(a.recipeId, [...(by.get(a.recipeId) ?? []), a]);
    return recipes.map((recipe) => {
      const list = by.get(recipe.id) ?? [];
      return { recipe, attempts: list, stats: stats(list) };
    });
  }, []);
}

export function useToast(): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg, useCallback((m: string) => setMsg(m), [])];
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export type PlateState = Omit<Plate, 'recipeId' | 'updatedAt'> & { updatedAt?: number };

/**
 * Today's grams for a recipe, saved on the device on every change so nothing
 * typed is lost when the app is closed. Null while loading.
 */
export function usePlate(recipeId: string): [PlateState | null, (p: PlateState) => void, () => void] {
  const stored = useLiveQuery(async () => (await db.plates.get(recipeId)) ?? null, [recipeId]);
  const [plate, setLocal] = useState<PlateState | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    if (stored === undefined || loadedFor === recipeId) return;
    setLocal(stored ?? { grams: {} });
    setLoadedFor(recipeId);
  }, [stored, recipeId, loadedFor]);
  const set = useCallback(
    (p: PlateState) => {
      const next = { ...p, updatedAt: Date.now() };
      setLocal(next);
      void db.plates.put({ ...next, recipeId });
    },
    [recipeId]
  );
  const clear = useCallback(() => {
    setLocal({ grams: {} });
    void db.plates.delete(recipeId);
  }, [recipeId]);
  return [loadedFor === recipeId ? plate : null, set, clear];
}

/** Has the user entered anything for this cooking yet? */
export function plateTouched(p: PlateState | null, usualParts: number, usual: Record<string, number>): boolean {
  if (!p) return false;
  return Object.entries(p.grams).some(([k, g]) => usual[k] !== g) || (!!p.parts && p.parts !== usualParts) || !!p.cooked || !!p.note;
}
