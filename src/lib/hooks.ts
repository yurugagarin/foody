import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import type { Attempt, Ingredient, Recipe } from '../types';
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

/** State kept for the browser session (survives going to cook mode and back). */
export function useSessionState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = sessionStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(v));
  }, [key, v]);
  return [v, setV];
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

/**
 * Per-recipe "Porsiyonum" state: the grams put in this time (whole recipe),
 * how many portions it was divided into, and optionally the cooked weight.
 */
export interface PlateState {
  grams: Record<string, number>;
  parts?: number;
  cooked?: number | null;
}

export function plateKey(recipeId: string): string {
  return `foody:plate2:${recipeId}`;
}
export function cookNoteKey(recipeId: string): string {
  return `foody:cooknote:${recipeId}`;
}
