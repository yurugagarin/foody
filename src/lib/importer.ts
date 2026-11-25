import type { Per100, Step } from '../types';
import { forGrams, add, ZERO, parseNum } from './nutrition';

export interface DraftIngredient {
  ad: string;
  gram: number;
  not?: string;
  per100?: Per100;
}

export interface DraftAttempt {
  tarih: string | null;
  puan: number | null;
  yontem?: string;
  derece?: number | null;
  sureDk?: number | null;
  not?: string;
}

export interface DraftRecipe {
  ad: string;
  kategori: string;
  porsiyon: number;
  birim?: string;
  birimAdet?: number;
  sureDk?: number | null;
  kaynak?: string;
  etiketler: string[];
  notlar?: string;
  malzemeler: DraftIngredient[];
  adimlar: Step[];
  denemeler: DraftAttempt[];
  kontrol?: Per100;
}

export interface ParseResult {
  recipes: DraftRecipe[];
  warnings: string[];
  errors: string[];
}

/** The prompt the user gives an AI chat so its answer can be pasted here. */
export const AI_PROMPT = `Bu tarif(ler)i kişisel tarif uygulamama aktarmak için aşağıdaki JSON formatında ver.

KURALLAR:
- Sadece tek bir JSON kod bloğu ver, açıklama yazma.
- Her malzeme GRAM cinsinden olsun ("1 adet", "1 diş", "1 yemek kaşığı", ml gibi ölçüleri yaklaşık grama çevir).
- Bütün gramlar ÇİĞ / KURU ağırlık olsun.
- Her malzeme için 100 gramdaki kcal, protein, karbonhidrat ve yağ değerlerini ver (ondalık için nokta).
- Aynı malzemeyi her tarifte AYNI isimle yaz.
- Tuz, karabiber gibi kalorisi önemsiz baharatlar için 100 g değerlerini 0 ver.
- Adımlarda süre (dakika) ve derece (°C) varsa ayrı alanlara koy.
- Tarifi daha önce yaptıysam ve konuştuysak "denemeler" alanına yaz, bilmiyorsan boş bırak.
- "kontrol_toplam" alanına tarifin toplam kcal, protein, karb ve yağını yaz.

FORMAT:
{
  "tarifler": [
    {
      "ad": "Tarif adı",
      "kategori": "Kahvaltı | Ana yemek | Çorba | Salata | Tatlı | Atıştırmalık | İçecek",
      "porsiyon": 1,
      "sure_dk": 20,
      "kaynak": "Yapay zekâ sohbeti",
      "etiketler": ["yüksek protein"],
      "malzemeler": [
        { "ad": "Makarna", "gram": 100, "her_100g": { "kcal": 360, "protein": 12.5, "karb": 72, "yag": 1.5 }, "not": "" }
      ],
      "adimlar": [
        { "sira": 1, "metin": "Makarnayı haşla.", "sure_dk": 9, "derece_c": null }
      ],
      "notlar": "",
      "denemeler": [
        { "tarih": "2026-11-24", "puan_10": 9, "yontem": "Tava", "derece_c": null, "sure_dk": 20, "not": "" }
      ],
      "kontrol_toplam": { "kcal": 0, "protein": 0, "karb": 0, "yag": 0 }
    }
  ]
}`;

type Obj = Record<string, unknown>;

function num(v: unknown): number | null {
  const n = parseNum(v as string | number | null | undefined);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

function per100Of(v: unknown): Per100 | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Obj;
  const kcal = num(o.kcal);
  if (kcal == null) return undefined;
  return {
    kcal,
    protein: num(o.protein) ?? 0,
    karb: num(o.karb ?? o.karbonhidrat) ?? 0,
    yag: num(o.yag ?? o['yağ']) ?? 0
  };
}

/** Pulls the JSON out of a pasted chat answer (with or without a ``` block). */
export function extractJson(text: string): unknown | undefined {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.search(/[[{]/);
    if (start < 0) continue;
    const body = c.slice(start);
    const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
    try {
      return JSON.parse(body.slice(0, end + 1));
    } catch {
      /* try the next candidate */
    }
  }
  return undefined;
}

function recipeFromJson(o: Obj, i: number, warnings: string[], errors: string[]): DraftRecipe | null {
  const ad = str(o.ad ?? o.isim ?? o.name);
  if (!ad) {
    errors.push(`${i + 1}. tarifin adı yok.`);
    return null;
  }
  const rawIngs = Array.isArray(o.malzemeler) ? (o.malzemeler as Obj[]) : [];
  const malzemeler: DraftIngredient[] = [];
  for (const m of rawIngs) {
    const mad = str(m.ad);
    if (!mad) continue;
    const gram = num(m.gram);
    if (gram == null) warnings.push(`${ad}: “${mad}” için gram yok, 0 g sayıldı.`);
    malzemeler.push({ ad: mad, gram: gram ?? 0, not: str(m.not) || undefined, per100: per100Of(m.her_100g ?? m.per100) });
  }
  const rawSteps = Array.isArray(o.adimlar) ? (o.adimlar as unknown[]) : [];
  const adimlar: Step[] = rawSteps
    .map((s) => (typeof s === 'string' ? { metin: s } : (s as Obj)))
    .map((s) => ({
      metin: str((s as Obj).metin),
      sureDk: num((s as Obj).sure_dk),
      derece: num((s as Obj).derece_c ?? (s as Obj).derece)
    }))
    .filter((s) => s.metin);
  const rawAtt = Array.isArray(o.denemeler) ? (o.denemeler as Obj[]) : [];
  const denemeler: DraftAttempt[] = rawAtt.map((d) => {
    const p = num(d.puan_10 ?? d.puan);
    const tarih = str(d.tarih);
    return {
      tarih: /^\d{4}-\d{2}-\d{2}$/.test(tarih) ? tarih : null,
      puan: p == null ? null : Math.min(10, Math.max(1, Math.round(p))),
      yontem: str(d.yontem) || undefined,
      derece: num(d.derece_c ?? d.derece),
      sureDk: num(d.sure_dk),
      not: str(d.not) || undefined
    };
  });
  const birim = str(o.birim) || undefined;
  const birimAdet = num(o.birim_adet) ?? undefined;
  return {
    ad,
    kategori: str(o.kategori).split('|')[0].trim() || 'Ana yemek',
    porsiyon: Math.max(1, num(o.porsiyon) ?? 1),
    birim: birim && birimAdet ? birim : undefined,
    birimAdet: birim && birimAdet ? birimAdet : undefined,
    sureDk: num(o.sure_dk),
    kaynak: str(o.kaynak) || undefined,
    etiketler: Array.isArray(o.etiketler) ? (o.etiketler as unknown[]).map(str).filter(Boolean) : [],
    notlar: str(o.notlar) || undefined,
    malzemeler,
    adimlar,
    denemeler,
    kontrol: per100Of(o.kontrol_toplam)
  };
}

const ING_LINE = /^\s*(?:[-•*·]|\d+[.)])?\s*(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram|ml)\b\.?\s+(.+?)\s*$/i;

/** Fallback for plain text such as "- 60 g yulaf ezmesi". */
function recipeFromText(text: string, warnings: string[]): DraftRecipe | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  let title = lines[0].replace(/^#+\s*/, '');
  let porsiyon = 1;
  const kisilik = title.match(/\((\d+)\s*kişilik\)/i);
  if (kisilik) {
    porsiyon = Number(kisilik[1]);
    title = title.replace(kisilik[0], '').trim();
  }
  const malzemeler: DraftIngredient[] = [];
  const adimlar: Step[] = [];
  let inSteps = false;
  for (const line of lines.slice(1)) {
    if (/yapılış|hazırlanış|tarif:/i.test(line)) {
      inSteps = true;
      const rest = line.replace(/^.*?(yapılışı?|hazırlanışı?)\s*:?/i, '').trim();
      if (rest) adimlar.push(...splitSteps(rest));
      continue;
    }
    if (inSteps) {
      adimlar.push(...splitSteps(line));
      continue;
    }
    const m = line.match(ING_LINE);
    if (m) {
      malzemeler.push({ ad: cap(m[2]), gram: Number(m[1].replace(',', '.')) });
    } else if (/^[-•*·]/.test(line)) {
      const raw = line.replace(/^[-•*·]\s*/, '');
      const count = raw.match(/^(\d+(?:[.,]\d+)?|yarım|bir)\s+(?:adet\s+|tane\s+|diş\s+)?(.+)$/i);
      const ad = cap(count ? count[2] : raw);
      warnings.push(`“${ad}” için gram yazmıyor, lütfen gramını gir.`);
      malzemeler.push({ ad, gram: 0, not: count ? `“${raw}” yazıyordu` : 'gram yazmıyordu' });
    }
  }
  if (!malzemeler.length) return null;
  return { ad: title, kategori: 'Ana yemek', porsiyon, etiketler: [], malzemeler, adimlar, denemeler: [], kaynak: 'Yapay zekâ sohbeti' };
}

function splitSteps(s: string): Step[] {
  return s
    .split(/\s*(?:^|\s)\d+[.)]\s+/)
    .map((x) => x.replace(/…$/, '').trim())
    .filter(Boolean)
    .map((metin) => ({ metin }));
}

function cap(s: string): string {
  return s.charAt(0).toLocaleUpperCase('tr') + s.slice(1);
}

/** Totals from the given 100 g values; used to check `kontrol_toplam`. */
export function draftTotals(r: DraftRecipe): Per100 {
  let t = ZERO;
  for (const m of r.malzemeler) if (m.per100) t = add(t, forGrams(m.per100, m.gram));
  return t;
}

export function parseImport(text: string): ParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const json = extractJson(text);
  let recipes: DraftRecipe[] = [];
  if (json !== undefined) {
    const list = Array.isArray(json) ? json : Array.isArray((json as Obj).tarifler) ? ((json as Obj).tarifler as unknown[]) : [json];
    recipes = list
      .map((o, i) => (o && typeof o === 'object' ? recipeFromJson(o as Obj, i, warnings, errors) : null))
      .filter((r): r is DraftRecipe => r !== null);
  } else {
    const r = recipeFromText(text, warnings);
    if (r) recipes = [r];
  }
  if (!recipes.length && !errors.length) errors.push('Metinde tarif bulamadım. Yapay zekâya formattaki JSON ile vermesini söyle.');
  for (const r of recipes) {
    if (!r.kontrol) continue;
    const t = draftTotals(r);
    const diff = Math.abs(t.kcal - r.kontrol.kcal);
    if (diff > Math.max(10, r.kontrol.kcal * 0.03)) {
      warnings.push(`${r.ad}: malzemelerden ${Math.round(t.kcal)} kcal çıkıyor, yapay zekâ ${Math.round(r.kontrol.kcal)} yazmış. Malzemeleri kontrol et.`);
    }
  }
  return { recipes, warnings, errors };
}
