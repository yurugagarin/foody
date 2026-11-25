import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../db';
import { useLibrary, copyText, useToast } from '../lib/hooks';
import { AI_PROMPT, parseImport, type DraftRecipe } from '../lib/importer';
import { applyImport, resolveIngredients, saveRecipe, type Resolution, type ResolutionChoice } from '../lib/repo';
import { add, forGrams, kcal, normName, parseNum, scale, ZERO, type Totals } from '../lib/nutrition';
import { KATEGORILER, type Ingredient, type Per100, type Recipe } from '../types';
import { Badges } from '../components/Badges';
import { PhotoPicker, PhotoView } from '../components/Photo';
import { Icon } from '../components/Icon';

type P100Str = Record<keyof Per100, string>;
const EMPTY_P: P100Str = { kcal: '', protein: '', karb: '', yag: '' };
const PF: [keyof Per100, string][] = [['kcal', 'KCAL'], ['protein', 'P'], ['karb', 'K'], ['yag', 'Y']];

interface IngRow { key: string; ad: string; gram: string; not: string; p: P100Str }
interface StepRow { key: string; metin: string; sureDk: string; derece: string }
interface Form {
  ad: string; kategori: string; porsiyon: string; birim: string; birimAdet: string; sureDk: string;
  kaynak: string; etiketler: string; notlar: string; kapakFotoId?: string;
  malzemeler: IngRow[]; adimlar: StepRow[];
}

let seq = 0;
const k = () => `r${++seq}`;
const s = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));
const pStr = (p?: Per100): P100Str => (p ? { kcal: s(p.kcal), protein: s(p.protein), karb: s(p.karb), yag: s(p.yag) } : { ...EMPTY_P });
const pNum = (p: P100Str): Per100 | undefined => {
  const kc = parseNum(p.kcal);
  if (!Number.isFinite(kc)) return undefined;
  const z = (x: string) => (Number.isFinite(parseNum(x)) ? parseNum(x) : 0);
  return { kcal: kc, protein: z(p.protein), karb: z(p.karb), yag: z(p.yag) };
};

function emptyForm(): Form {
  return { ad: '', kategori: 'Ana yemek', porsiyon: '1', birim: '', birimAdet: '', sureDk: '', kaynak: '', etiketler: '', notlar: '', malzemeler: [{ key: k(), ad: '', gram: '', not: '', p: { ...EMPTY_P } }], adimlar: [{ key: k(), metin: '', sureDk: '', derece: '' }] };
}

function formFromRecipe(r: Recipe, lib: Map<string, Ingredient>): Form {
  return {
    ad: r.ad, kategori: r.kategori, porsiyon: s(r.porsiyon), birim: r.birim ?? '', birimAdet: s(r.birimAdet), sureDk: s(r.sureDk),
    kaynak: r.kaynak ?? '', etiketler: r.etiketler.join(', '), notlar: r.notlar ?? '', kapakFotoId: r.kapakFotoId,
    malzemeler: r.malzemeler.map((m) => ({ key: k(), ad: lib.get(m.ingId)?.ad ?? '', gram: s(m.gram), not: m.not ?? '', p: { ...EMPTY_P } })),
    adimlar: r.adimlar.map((x) => ({ key: k(), metin: x.metin, sureDk: s(x.sureDk), derece: s(x.derece) }))
  };
}

function formFromDraft(d: DraftRecipe, choices: Record<string, P100Str>): Form {
  return {
    ad: d.ad, kategori: d.kategori, porsiyon: s(d.porsiyon), birim: d.birim ?? '', birimAdet: s(d.birimAdet), sureDk: s(d.sureDk),
    kaynak: d.kaynak ?? '', etiketler: d.etiketler.join(', '), notlar: d.notlar ?? '',
    malzemeler: d.malzemeler.map((m) => ({ key: k(), ad: m.ad, gram: s(m.gram), not: m.not ?? '', p: choices[normName(m.ad)] ?? pStr(m.per100) })),
    adimlar: d.adimlar.map((x) => ({ key: k(), metin: x.metin, sureDk: s(x.sureDk), derece: s(x.derece) }))
  };
}

export function Editor() {
  const { id } = useParams();
  const lib = useLibrary();
  const [tab, setTab] = useState<'yapistir' | 'elle'>(id ? 'elle' : 'yapistir');
  const [form, setForm] = useState<Form | null>(id ? null : emptyForm());

  useEffect(() => {
    if (!id || !lib || form) return;
    void db.recipes.get(id).then((r) => r && setForm(formFromRecipe(r, lib)));
  }, [id, lib, form]);

  if (!lib || !form) return null;
  return (
    <div className="page wide">
      <header className="between">
        <Link to={id ? `/tarif/${id}` : '/'} className="icon-btn" aria-label="Vazgeç"><Icon name="close" /></Link>
        <span className="lab">{id ? 'Tarifi düzenle' : 'Yeni tarif'}</span>
        <span style={{ width: 44 }} />
      </header>
      {!id && (
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'yapistir'} className={tab === 'yapistir' ? 'on' : ''} onClick={() => setTab('yapistir')}>Yapay zekâdan yapıştır</button>
          <button role="tab" aria-selected={tab === 'elle'} className={tab === 'elle' ? 'on' : ''} onClick={() => setTab('elle')}>Elle yaz</button>
        </div>
      )}
      {tab === 'yapistir' && !id ? (
        <ImportPanel lib={lib} toForm={(f) => { setForm(f); setTab('elle'); }} />
      ) : (
        <FormPanel id={id ?? null} lib={lib} form={form} setForm={setForm} />
      )}
    </div>
  );
}

function ImportPanel({ lib, toForm }: { lib: Map<string, Ingredient>; toForm: (f: Form) => void }) {
  const [text, setText] = useState('');
  const [vals, setVals] = useState<Record<string, P100Str>>({});
  const [update, setUpdate] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();
  const nav = useNavigate();
  const parsed = useMemo(() => (text.trim() ? parseImport(text) : null), [text]);
  const res: Resolution[] = useMemo(() => (parsed ? resolveIngredients(parsed.recipes, [...lib.values()]) : []), [parsed, lib]);

  useEffect(() => {
    setVals(Object.fromEntries(res.filter((r) => r.status !== 'var').map((r) => [r.key, pStr(r.given)])));
    setUpdate({});
  }, [res]);

  const valuesFor = (r: Resolution): Per100 | undefined => {
    if (r.status === 'var') return r.existing;
    if (r.status === 'farkli' && !update[r.key]) return r.existing;
    return pNum(vals[r.key] ?? EMPTY_P);
  };
  const missing = res.filter((r) => (r.status === 'eksik' || r.status === 'yeni') && !pNum(vals[r.key] ?? EMPTY_P));
  const total = (d: DraftRecipe): Totals => d.malzemeler.reduce((t, m) => {
    const r = res.find((x) => x.key === normName(m.ad));
    const v = r && valuesFor(r);
    return v ? add(t, forGrams(v, m.gram)) : t;
  }, ZERO);

  const save = async () => {
    if (!parsed) return;
    setBusy(true);
    const choices: Record<string, ResolutionChoice> = {};
    for (const r of res) {
      if (r.status === 'yeni' || r.status === 'eksik') choices[r.key] = { values: pNum(vals[r.key]) };
      if (r.status === 'farkli') choices[r.key] = { values: pNum(vals[r.key]), updateLibrary: !!update[r.key] };
    }
    const ids = await applyImport(parsed.recipes, choices);
    nav(ids.length === 1 ? `/tarif/${ids[0]}` : '/');
  };

  return (
    <div className="editor-grid">
      <div className="stack">
        <h1 className="h1">Sohbetten kopyala,<br /><span className="it gold">buraya yapıştır.</span></h1>
        <div className="card stack" style={{ gap: 10 }}>
          <div className="between"><span className="lab">Yapay zekâya bu kalıbı ver</span>
            <button className="btn sm" onClick={async () => show((await copyText(AI_PROMPT)) ? 'Kalıp kopyalandı.' : 'Kopyalanamadı.')}><Icon name="copy" size={14} />Kalıbı kopyala</button>
          </div>
          <span className="small muted" style={{ lineHeight: 1.45 }}>Cevabı aşağıya olduğu gibi yapıştır. Malzemeler gram gram, 100 g değerleriyle gelir; kütüphanende olanlar tanınır, yeniler bir kez onaylanıp kaydedilir. Düz yazı tarif de yapıştırabilirsin (“- 60 g yulaf” gibi).</span>
        </div>
        <label className="field">
          <span className="lab">Yapıştırdığın metin</span>
          <textarea className="textarea" rows={14} value={text} onChange={(e) => setText(e.target.value)} placeholder={'{\n  "tarifler": [ … ]\n}'} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
        </label>
      </div>

      <div className="aside stack">
        {!parsed && <p className="dashed muted small" style={{ margin: 0 }}>Yapıştırınca okunan tarifler burada görünür.</p>}
        {parsed?.errors.map((e) => <p key={e} className="notice warn" style={{ margin: 0 }}>{e}</p>)}
        {parsed?.warnings.map((w) => <p key={w} className="notice warn" style={{ margin: 0 }}>{w}</p>)}
        {parsed?.recipes.map((d, i) => (
          <section key={i} className="card stack" style={{ gap: 10 }}>
            <div className="between" style={{ alignItems: 'baseline' }}>
              <span className="sf" style={{ fontSize: 24 }}>{d.ad}</span>
              <span className="small muted">{d.malzemeler.length} malzeme · {d.adimlar.length} adım</span>
            </div>
            <Badges t={scale(total(d), 1 / d.porsiyon)} size="md" label={d.porsiyon > 1 ? 'porsiyon' : undefined} />
            {parsed.recipes.length === 1 && <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => toForm(formFromDraft(d, vals))}><Icon name="edit" size={14} />Kaydetmeden önce düzenle</button>}
          </section>
        ))}
        {res.length > 0 && (
          <section className="stack" style={{ gap: 0 }}>
            <span className="lab" style={{ marginBottom: 6 }}>Malzemeler ({res.length})</span>
            {res.map((r) => (
              <div key={r.key} className="stack p100" style={{ gap: 8, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="between">
                  <span className="row" style={{ gap: 8 }}>
                    <span style={{ color: r.status === 'var' ? 'var(--k)' : 'var(--gold)' }}><Icon name={r.status === 'var' ? 'check' : r.status === 'farkli' || r.status === 'eksik' ? 'warn' : 'plus'} size={16} stroke={2.4} /></span>
                    {r.ad}
                  </span>
                  <span className="small muted">
                    {r.status === 'var' && `kütüphaneden · ${kcal(r.existing!.kcal)} kcal`}
                    {r.status === 'yeni' && 'yeni · değerleri onayla'}
                    {r.status === 'eksik' && '100 g değerlerini gir'}
                    {r.status === 'farkli' && `kütüphanede ${kcal(r.existing!.kcal)} kcal`}
                  </span>
                </div>
                {r.status === 'farkli' && (
                  <label className="row small" style={{ minHeight: 36 }}>
                    <input type="checkbox" checked={!!update[r.key]} onChange={(e) => setUpdate({ ...update, [r.key]: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--gold)' }} />
                    Yeni değerlerle güncelle ({vals[r.key]?.kcal} kcal) — kapalıysa kütüphanedeki kalır
                  </label>
                )}
                {(r.status === 'yeni' || r.status === 'eksik' || (r.status === 'farkli' && update[r.key])) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6 }}>
                    {PF.map(([f, l]) => (
                      <label key={f} className="field"><span className="lab">{l}</span>
                        <input className={`input${f === 'kcal' ? ' hl' : ''}`} inputMode="decimal" value={vals[r.key]?.[f] ?? ''} onChange={(e) => setVals({ ...vals, [r.key]: { ...(vals[r.key] ?? EMPTY_P), [f]: e.target.value } })} />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
        {parsed && parsed.recipes.length > 0 && (
          <>
            {missing.length > 0 && <p className="notice warn" style={{ margin: 0 }}>Şunların 100 g kalorisini gir: {missing.map((m) => m.ad).join(', ')}.</p>}
            <button className="btn gold" style={{ height: 58 }} disabled={busy || missing.length > 0} onClick={save}>
              {parsed.recipes.length === 1 ? 'Tarifi kaydet' : `${parsed.recipes.length} tarifi kaydet`}
            </button>
          </>
        )}
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function FormPanel({ id, lib, form, setForm }: { id: string | null; lib: Map<string, Ingredient>; form: Form; setForm: (f: Form) => void }) {
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const byName = useMemo(() => new Map([...lib.values()].map((i) => [normName(i.ad), i])), [lib]);
  const set = (p: Partial<Form>) => setForm({ ...form, ...p });
  const setIng = (key: string, p: Partial<IngRow>) => set({ malzemeler: form.malzemeler.map((m) => (m.key === key ? { ...m, ...p } : m)) });
  const setStep = (key: string, p: Partial<StepRow>) => set({ adimlar: form.adimlar.map((x) => (x.key === key ? { ...x, ...p } : x)) });
  const move = (i: number, d: number) => {
    const a = form.adimlar.slice();
    const [x] = a.splice(i, 1);
    a.splice(i + d, 0, x);
    set({ adimlar: a });
  };

  const total = form.malzemeler.reduce((t, m) => {
    const v = byName.get(normName(m.ad)) ?? pNum(m.p);
    const g = parseNum(m.gram);
    return v && Number.isFinite(g) ? add(t, forGrams(v, g)) : t;
  }, ZERO);
  const por = Math.max(1, parseNum(form.porsiyon) || 1);

  const save = async () => {
    if (!form.ad.trim()) return setErr('Tarifin adını yaz.');
    const rows = form.malzemeler.filter((m) => m.ad.trim());
    const bad = rows.filter((m) => !byName.get(normName(m.ad)) && !pNum(m.p));
    if (bad.length) return setErr(`Yeni malzemelerin 100 g kalorisini gir: ${bad.map((b) => b.ad).join(', ')}.`);
    const n = (x: string) => (Number.isFinite(parseNum(x)) ? parseNum(x) : null);
    setBusy(true);
    const rid = await saveRecipe(id, {
      ad: form.ad.trim(),
      kategori: form.kategori,
      porsiyon: por,
      birim: undefined,
      birimAdet: undefined,
      sureDk: n(form.sureDk),
      kaynak: form.kaynak.trim() || undefined,
      etiketler: form.etiketler.split(',').map((t) => t.trim()).filter(Boolean),
      notlar: form.notlar.trim() || undefined,
      kapakFotoId: form.kapakFotoId,
      malzemeler: rows.map((m) => ({ ad: m.ad.trim(), gram: n(m.gram) ?? 0, not: m.not.trim() || undefined, per100: pNum(m.p) })),
      adimlar: form.adimlar.map((x) => ({ metin: x.metin.trim(), sureDk: n(x.sureDk), derece: n(x.derece) }))
    });
    nav(`/tarif/${rid}`);
  };

  return (
    <div className="editor-grid">
      <div className="stack" style={{ gap: 22 }}>
        <label className="field"><span className="lab">Tarifin adı</span><input className="input" style={{ fontFamily: 'var(--serif)', fontSize: 26, minHeight: 56 }} value={form.ad} onChange={(e) => set({ ad: e.target.value })} placeholder="Somonlu makarna" /></label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <label className="field"><span className="lab">Kategori</span>
            <select className="select" value={form.kategori} onChange={(e) => set({ kategori: e.target.value })}>
              {Array.from(new Set([...KATEGORILER, form.kategori])).map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="field"><span className="lab">Porsiyon</span><input className="input" inputMode="numeric" value={form.porsiyon} onChange={(e) => set({ porsiyon: e.target.value })} /></label>
          <label className="field"><span className="lab">Süre (dk)</span><input className="input" inputMode="numeric" value={form.sureDk} onChange={(e) => set({ sureDk: e.target.value })} /></label>
          <label className="field"><span className="lab">Kaynak</span><input className="input" value={form.kaynak} onChange={(e) => set({ kaynak: e.target.value })} placeholder="Yapay zekâ sohbeti" /></label>
        </div>
        <label className="field"><span className="lab">Etiketler (virgülle)</span><input className="input" value={form.etiketler} onChange={(e) => set({ etiketler: e.target.value })} placeholder="yüksek protein, hızlı" /></label>

        <section className="stack" style={{ gap: 0 }}>
          <div className="between"><h2 className="h2">Malzemeler</h2><span className="small muted">çiğ / kuru gram</span></div>
          <datalist id="lib-names">{[...lib.values()].map((i) => <option key={i.id} value={i.ad} />)}</datalist>
          {form.malzemeler.map((m) => {
            const known = byName.get(normName(m.ad));
            const v = known ?? pNum(m.p);
            const g = parseNum(m.gram);
            return (
              <div key={m.key} className="ing-edit p100">
                <div className="stack" style={{ gap: 4 }}>
                  <input className="input" list="lib-names" aria-label="Malzeme" value={m.ad} onChange={(e) => setIng(m.key, { ad: e.target.value })} placeholder="Malzeme" />
                  <span className="small muted">
                    {!m.ad.trim() ? ' ' : known ? `kütüphaneden · 100 g = ${kcal(known.kcal)} kcal` : <span className="gold">yeni malzeme · 100 g değerlerini gir</span>}
                    {v && Number.isFinite(g) ? <> · <span className="pill">{kcal(forGrams(v, g).kcal)} kcal</span></> : null}
                  </span>
                </div>
                <input className="input" inputMode="decimal" aria-label="Gram" value={m.gram} onChange={(e) => setIng(m.key, { gram: e.target.value })} placeholder="g" />
                <button className="stp" aria-label="Malzemeyi sil" onClick={() => set({ malzemeler: form.malzemeler.filter((x) => x.key !== m.key) })}><Icon name="close" size={16} /></button>
                {m.ad.trim() && !known && (
                  <div className="extra">
                    {PF.map(([f, l]) => (
                      <label key={f} className="field"><span className="lab">{l} / 100 g</span><input className={`input${f === 'kcal' ? ' hl' : ''}`} inputMode="decimal" value={m.p[f]} onChange={(e) => setIng(m.key, { p: { ...m.p, [f]: e.target.value } })} /></label>
                    ))}
                  </div>
                )}
                <input className="input" style={{ gridColumn: '1 / -1', minHeight: 40, fontSize: 14 }} aria-label="Not" value={m.not} onChange={(e) => setIng(m.key, { not: e.target.value })} placeholder="Not (ör. 1 diş, marka)" />
              </div>
            );
          })}
          <button className="btn sm" style={{ alignSelf: 'flex-start', marginTop: 10 }} onClick={() => set({ malzemeler: [...form.malzemeler, { key: k(), ad: '', gram: '', not: '', p: { ...EMPTY_P } }] })}><Icon name="plus" size={14} />Malzeme ekle</button>
        </section>

        <section className="stack" style={{ gap: 10 }}>
          <h2 className="h2">Yapılış</h2>
          {form.adimlar.map((x, i) => (
            <div key={x.key} className="card stack" style={{ gap: 8, padding: 12 }}>
              <div className="between"><span className="sf it gold" style={{ fontSize: 24 }}>{String(i + 1).padStart(2, '0')}</span>
                <div className="row" style={{ gap: 4 }}>
                  <button className="stp" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={16} /></button>
                  <button className="stp" aria-label="Aşağı taşı" disabled={i === form.adimlar.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={16} /></button>
                  <button className="stp" aria-label="Adımı sil" onClick={() => set({ adimlar: form.adimlar.filter((y) => y.key !== x.key) })}><Icon name="close" size={16} /></button>
                </div>
              </div>
              <textarea className="textarea" rows={2} aria-label={`Adım ${i + 1}`} value={x.metin} onChange={(e) => setStep(x.key, { metin: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label className="field"><span className="lab">Süre dk</span><input className="input" inputMode="numeric" value={x.sureDk} onChange={(e) => setStep(x.key, { sureDk: e.target.value })} /></label>
                <label className="field"><span className="lab">Derece °C</span><input className="input" inputMode="numeric" value={x.derece} onChange={(e) => setStep(x.key, { derece: e.target.value })} /></label>
              </div>
            </div>
          ))}
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => set({ adimlar: [...form.adimlar, { key: k(), metin: '', sureDk: '', derece: '' }] })}><Icon name="plus" size={14} />Adım ekle</button>
        </section>
        <label className="field"><span className="lab">Notlar</span><textarea className="textarea" rows={3} value={form.notlar} onChange={(e) => set({ notlar: e.target.value })} /></label>
      </div>

      <div className="aside stack">
        <div className="row" style={{ gap: 14 }}>
          <PhotoView id={form.kapakFotoId} thumb empty="kapak" style={{ width: 96, height: 96, borderRadius: 18 }} />
          <div className="stack" style={{ gap: 6 }}>
            <span>Kapak fotoğrafı</span>
            <PhotoPicker label={form.kapakFotoId ? 'Değiştir' : 'Fotoğraf seç'} onPicked={(pid) => set({ kapakFotoId: pid })} />
          </div>
        </div>
        <div className="card stack">
          <span className="lab">{por > 1 ? '1 porsiyon' : 'Tarifin tamamı'}</span>
          <Badges t={scale(total, 1 / por)} size="md" />
          {por > 1 && <span className="small muted">Bütün tarif: {kcal(total.kcal)} kcal · {Math.round(total.gram)} g</span>}
        </div>
        {err && <p className="notice warn" style={{ margin: 0 }}>{err}</p>}
        <button className="btn gold" style={{ height: 58 }} disabled={busy} onClick={save}>{id ? 'Değişiklikleri kaydet' : 'Tarifi kaydet'}</button>
      </div>
    </div>
  );
}
