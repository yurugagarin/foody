/** Values per 100 g, as written on the package or in a food table. */
export interface Per100 {
  kcal: number;
  protein: number;
  karb: number;
  yag: number;
}

/** One entry of the ingredient library: entered once, reused by every recipe. */
export interface Ingredient extends Per100 {
  id: string;
  ad: string;
  /** Always at home (oil, salt, water…): ignored by "Dolabımda ne var?". */
  temel?: boolean;
  createdAt: number;
}

export interface RecipeIngredient {
  ingId: string;
  /** Usual grams for the whole recipe (raw / dry weight). */
  gram: number;
  not?: string;
}

export interface Step {
  metin: string;
  sureDk?: number | null;
  derece?: number | null;
}

export interface Recipe {
  id: string;
  ad: string;
  kategori: string;
  /** How many portions the whole recipe makes. */
  porsiyon: number;
  /** Optional countable unit, e.g. 16 "köfte" or 6 "dilim". */
  birim?: string;
  birimAdet?: number;
  sureDk?: number | null;
  kaynak?: string;
  etiketler: string[];
  notlar?: string;
  malzemeler: RecipeIngredient[];
  adimlar: Step[];
  kapakFotoId?: string;
  createdAt: number;
  updatedAt: number;
}

/** One time the recipe was cooked. */
export interface Attempt {
  id: string;
  recipeId: string;
  /** ISO date (yyyy-mm-dd) or null when unknown. */
  tarih: string | null;
  /** 1–10, or null when not rated. */
  puan: number | null;
  yontem?: string;
  derece?: number | null;
  sureDk?: number | null;
  not?: string;
  fotoId?: string;
  /** Grams used this time, by ingredient id (whole recipe). */
  gramlar?: Record<string, number>;
  /** How many portions the recipe was divided into this time. */
  bolum?: number;
  /** Weight of the whole dish after cooking (g), if weighed. */
  pismisGram?: number | null;
  enIyi?: boolean;
  createdAt: number;
}

export interface Photo {
  id: string;
  blob: Blob;
  thumb: Blob;
  createdAt: number;
}

export const KATEGORILER = ['Kahvaltı', 'Ana yemek', 'Çorba', 'Salata', 'Tatlı', 'Atıştırmalık', 'İçecek'];
export const YONTEMLER = ['Tava', 'Fırın', 'Air fryer', 'Ocak', 'Döküm tava', 'Izgara', 'Fırınsız'];
