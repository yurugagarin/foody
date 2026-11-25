import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../db';
import { useLibrary } from '../lib/hooks';
import { f1, forGrams, kcal, normName, parseNum } from '../lib/nutrition';
import { isStapleName } from '../lib/repo';
import { Badges } from '../components/Badges';
import { Icon } from '../components/Icon';
import type { Ingredient } from '../types';

function numStr(x: number): string {
  return String(x).replace('.', ',');
}

export function Library() {
  const lib = useLibrary();
  const recipes = useLiveQuery(() => db.recipes.toArray(), []);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [grams, setGrams] = useState('5');

  const list = useMemo(() => {
    const nq = normName(q);
    return [...(lib?.values() ?? [])].filter((i) => !nq || normName(i.ad).includes(nq)).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  }, [lib, q]);

  if (!lib || !recipes) return null;
  const cur = (sel && lib.get(sel)) || list[0];
  const usedIn = (id: string) => recipes.filter((r) => r.malzemeler.some((m) => m.ingId === id));
  const g = parseNum(grams);
  const res = cur && Number.isFinite(g) ? forGrams(cur, g) : null;

  return (
    <div className="page wide">
      <div className="stack" style={{ gap: 6 }}>
        <span className="lab">{lib.size} malzeme kayıtlı</span>
        <h1 className="h1">Malzeme <span className="it gold">kütüphanem</span></h1>
        <p className="muted" style={{ margin: 0, fontWeight: 300, lineHeight: 1.45, maxWidth: 620 }}>100 gramdaki değerleri bir kez gir. Hangi tarifte kaç gram kullanırsan kullan, hesap buradan yapılır. Değeri burada düzeltirsen o malzemenin geçtiği bütün tarifler güncellenir.</p>
      </div>
      <div className="lib-grid">
        <div className="aside stack" style={{ gap: 16 }}>
          {cur && (
            <section className="card stack" style={{ gap: 14 }}>
              <div className="between" style={{ alignItems: 'baseline' }}><h2 className="sf" style={{ fontSize: 30 }}>{cur.ad}</h2><span className="lab">100 g'da</span></div>
              <Badges t={cur} size="md" />
              <div className="stack" style={{ gap: 10, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                <label className="lab" htmlFor="kg">Kaç gram koydun?</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) repeat(3, 56px)', gap: 6 }}>
                  <input id="kg" className="input hl" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} style={{ fontSize: 20 }} />
                  {[5, 50, 100].map((x) => <button key={x} className="btn sm" style={{ borderRadius: 14, height: 48, padding: 0 }} onClick={() => setGrams(String(x))}>{x} g</button>)}
                </div>
                {res && (
                  <div className="row">
                    <span className="rb kcal" style={{ width: 74, height: 74 }}><b style={{ fontSize: 22 }}>{kcal(res.kcal)}</b><small>KCAL</small></span>
                    <div className="stack small" style={{ gap: 4 }}>
                      <span><b>{grams} g</b> {cur.ad.toLocaleLowerCase('tr')}</span>
                      <span style={{ color: 'var(--soft)' }}>P {f1(res.protein)} · K {f1(res.karb)} · Y {f1(res.yag)}</span>
                    </div>
                  </div>
                )}
              </div>
              <EditIngredient key={cur.id} ing={cur} usedIn={usedIn(cur.id).length} onDeleted={() => setSel(null)} />
              {usedIn(cur.id).length > 0 && (
                <div className="row wrap small" style={{ gap: 6 }}>
                  <span className="muted">Kullanıldığı tarifler:</span>
                  {usedIn(cur.id).map((r) => <Link key={r.id} to={`/tarif/${r.id}`}>{r.ad}</Link>)}
                </div>
              )}
            </section>
          )}
          <NewIngredient lib={lib} onAdded={setSel} />
        </div>

        <div className="stack" style={{ gap: 0 }}>
          <label className="row input" style={{ borderRadius: 99, marginBottom: 6 }}>
            <Icon name="search" size={16} />
            <span className="sr">Malzeme ara</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Malzeme ara" style={{ border: 0, outline: 0, background: 'transparent', flex: 1, minWidth: 0, fontSize: 15, color: 'var(--text)' }} />
          </label>
          {list.map((i) => (
            <button key={i.id} className={`list-btn${cur?.id === i.id ? ' on' : ''}`} onClick={() => { setSel(i.id); window.innerWidth < 960 && window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <span className="grow">{i.ad}{i.temel ? <span className="small muted"> · evde hep var</span> : null}</span>
              <span className="small muted">P {f1(i.protein)} · K {f1(i.karb)} · Y {f1(i.yag)}</span>
              <span className="pill" style={{ minWidth: 70, textAlign: 'center' }}>{kcal(i.kcal)} kcal</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const FIELDS: [keyof Ingredient, string][] = [['kcal', 'KCAL'], ['protein', 'P (g)'], ['karb', 'K (g)'], ['yag', 'Y (g)']];

function EditIngredient({ ing, usedIn, onDeleted }: { ing: Ingredient; usedIn: number; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => {
    setV({ ad: ing.ad, ...Object.fromEntries(FIELDS.map(([k]) => [k, numStr(ing[k] as number)])) });
  }, [ing]);
  if (!open) return <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}><Icon name="edit" size={14} />Değerleri düzenle</button>;
  return (
    <div className="stack p100" style={{ gap: 8 }}>
      <label className="field"><span className="lab">Ad</span><input className="input" value={v.ad ?? ''} onChange={(e) => setV({ ...v, ad: e.target.value })} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6 }}>
        {FIELDS.map(([k, l]) => (
          <label key={k} className="field"><span className="lab">{l}</span><input className={`input${k === 'kcal' ? ' hl' : ''}`} inputMode="decimal" value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
        ))}
      </div>
      <label className="row small" style={{ minHeight: 40 }}>
        <input type="checkbox" checked={!!ing.temel} onChange={(e) => db.ingredients.update(ing.id, { temel: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--gold)' }} />
        Evde hep var (Dolabım'da sorma)
      </label>
      <div className="row wrap">
        <button className="btn sm gold" onClick={async () => {
          const upd: Partial<Ingredient> = { ad: (v.ad ?? ing.ad).trim() || ing.ad };
          for (const [k] of FIELDS) { const n = parseNum(v[k]); if (Number.isFinite(n)) (upd as Record<string, number>)[k] = n; }
          await db.ingredients.update(ing.id, upd);
          setOpen(false);
        }}>Kaydet</button>
        <button className="btn sm" onClick={() => setOpen(false)}>Vazgeç</button>
        <button className="btn sm danger" disabled={usedIn > 0} title={usedIn ? 'Bir tarifte kullanılıyor' : undefined} onClick={async () => {
          if (confirm(`${ing.ad} silinsin mi?`)) { await db.ingredients.delete(ing.id); onDeleted(); }
        }}><Icon name="trash" size={14} />Sil</button>
      </div>
      {usedIn > 0 && <span className="small muted">{usedIn} tarifte kullanıldığı için silinemez.</span>}
    </div>
  );
}

function NewIngredient({ lib, onAdded }: { lib: Map<string, Ingredient>; onAdded: (id: string) => void }) {
  const [v, setV] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  return (
    <section className="dashed stack p100" style={{ gap: 10, borderColor: 'var(--gold)' }}>
      <div className="between" style={{ alignItems: 'baseline' }}><span className="sf it" style={{ fontSize: 24 }}>Yeni malzeme</span><span className="small muted">paketteki “100 g için” tablosundan</span></div>
      <label className="field"><span className="sr">Malzeme adı</span><input className="input" placeholder="Malzeme adı (ör. hindistan cevizi yağı)" value={v.ad ?? ''} onChange={(e) => setV({ ...v, ad: e.target.value })} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6 }}>
        {FIELDS.map(([k, l]) => (
          <label key={k} className="field"><span className="lab">{l}</span><input className={`input${k === 'kcal' ? ' hl' : ''}`} inputMode="decimal" value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
        ))}
      </div>
      {err && <span className="small" style={{ color: 'var(--danger)' }}>{err}</span>}
      <button className="btn gold" onClick={async () => {
        const ad = (v.ad ?? '').trim();
        if (!ad) return setErr('Adını yaz.');
        if ([...lib.values()].some((i) => normName(i.ad) === normName(ad))) return setErr('Bu malzeme zaten var.');
        const n = Object.fromEntries(FIELDS.map(([k]) => [k, parseNum(v[k])]));
        if (!Number.isFinite(n.kcal)) return setErr('En azından kalorisini gir.');
        const ing: Ingredient = { id: newId(), ad, kcal: n.kcal, protein: Number.isFinite(n.protein) ? n.protein : 0, karb: Number.isFinite(n.karb) ? n.karb : 0, yag: Number.isFinite(n.yag) ? n.yag : 0, temel: isStapleName(ad), createdAt: Date.now() };
        await db.ingredients.add(ing);
        setV({});
        setErr('');
        onAdded(ing.id);
      }}>Kütüphaneye kaydet</button>
    </section>
  );
}
