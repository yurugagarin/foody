import Dexie, { type Table } from 'dexie';
import type { Attempt, Ingredient, Photo, Recipe } from './types';

/** Everything lives on the device, in IndexedDB. */
export class FoodyDB extends Dexie {
  ingredients!: Table<Ingredient, string>;
  recipes!: Table<Recipe, string>;
  attempts!: Table<Attempt, string>;
  photos!: Table<Photo, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor(name = 'foody') {
    super(name);
    this.version(1).stores({
      ingredients: 'id, ad',
      recipes: 'id, ad, kategori, updatedAt',
      attempts: 'id, recipeId, tarih, createdAt',
      photos: 'id',
      meta: 'key'
    });
  }
}

export const db = new FoodyDB();

export function newId(): string {
  return crypto.randomUUID();
}
