import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLibrary, useRecipes, copyText, useToast } from '../lib/hooks';
import { matchPantry, countsForPantry } from '../lib/pantry';
import { perPortion } from '../lib/nutrition';
import { AI_PROMPT } from '../lib/importer';
import { KcalDot } from '../components/Badges';
import { PhotoView } from '../components/Photo';
import { Icon } from '../components/Icon';

const KEY = 'foody:pantry';

export function Pantry() {
  const lib = useLibrary();
  const all = useRecipes();
  const [have, setHave] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]')));
  const [toast, show] = useToast();
  const update = (s: Set<string>) => {
    setHave(s);
    localStorage.setItem(KEY, JSON.stringify([...s]));
  };

  const chips = useMemo(() => {
    if (!lib || !all) return [];
    const count = new Map<string, number>();
    for (const { recipe } of all) for (const m of recipe.malzemeler) if (countsForPantry(lib.get(m.ingId))) count.set(m.ingId, (count.get(m.ingId) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1] || lib.get(a[0])!.ad.localeCompare(lib.get(b[0])!.ad, 'tr')).map(([id]) => lib.get(id)!);
  }, [lib, all]);

  if (!lib || !all) return null;
  const byId = new Map(all.map((r) => [r.recipe.id, r]));
  const results = matchPantry(all.map((r) => r.recipe), lib, have)
    .sort((a, b) => b.ratio - a.ratio || (byId.get(b.recipe.id)!.stats.avg ?? 0) - (byId.get(a.recipe.id)!.stats.avg ?? 0))
    .slice(0, 8);
  const haveNames = chips.filter((c) => have.has(c.id)).map((c) => c.ad);

  return (
    <div className="page">
      <header className="between">
        <Link to="/" className="icon-btn mobile-only" aria-label="Galeriye dön"><Icon name="back" /></Link>
        <span className="lab">{have.size} malzeme seçili</span>
        <button className="btn sm" onClick={() => update(new Set())}>Temizle</button>
      </header>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="h1">Dolabımda<br /><span className="it gold">ne var?</span></h1>
        <p className="muted" style={{ margin: 0, fontWeight: 300, lineHeight: 1.45 }}>Elindekilere dokun, kayıtlı tariflerinden yapabileceklerin çıksın. Yağ, tuz, baharat gibi evde hep olanlar hesaba katılmaz.</p>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        {chips.map((c) => (
          <button key={c.id} aria-pressed={have.has(c.id)} className={`chip${have.has(c.id) ? ' on' : ''}`} onClick={() => {
            const s = new Set(have);
            if (s.has(c.id)) s.delete(c.id); else s.add(c.id);
            update(s);
          }}>{c.ad}</button>
        ))}
      </div>
      <section className="stack" style={{ gap: 12, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
        <div className="between"><h2 className="h2">Bunları yapabilirsin</h2><span className="small muted">eşleşme · puan</span></div>
        {results.map((m) => {
          const r = byId.get(m.recipe.id)!;
          const full = m.missing.length === 0;
          return (
            <Link key={m.recipe.id} to={`/tarif/${m.recipe.id}`} className="card" style={{ display: 'grid', gridTemplateColumns: '76px minmax(0,1fr) 56px', gap: 12, alignItems: 'center', padding: 10, textDecoration: 'none', color: 'var(--text)', borderColor: full ? 'var(--gold)' : undefined }}>
              <div style={{ position: 'relative' }}>
                <PhotoView id={m.recipe.kapakFotoId ?? r.attempts.find((a) => a.fotoId)?.fotoId} thumb style={{ width: 76, height: 76, borderRadius: 14 }} />
                <span className="small" style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(15,14,13,0.75)', padding: '2px 6px', borderRadius: 99 }}><span className="gold">★</span> {r.stats.avg == null ? '–' : r.stats.avg.toFixed(1).replace('.', ',')}</span>
              </div>
              <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                <span className="sf" style={{ fontSize: 21, lineHeight: 1.05 }}>{m.recipe.ad}</span>
                <div style={{ height: 4, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}><div style={{ height: 4, width: `${Math.round(m.ratio * 100)}%`, background: full ? 'var(--k)' : 'var(--gold)' }} /></div>
                <span className="small" style={{ color: full ? 'var(--k)' : 'var(--muted)' }}>{full ? 'Hepsi var, hemen yapabilirsin' : `Eksik: ${m.missing.map((x) => lib.get(x)?.ad.toLocaleLowerCase('tr')).join(', ')}`}</span>
              </div>
              <KcalDot value={perPortion(m.recipe, lib).kcal} />
            </Link>
          );
        })}
        {results.length === 0 && <p className="muted small">Tariflerinde malzeme yok gibi görünüyor.</p>}
      </section>
      <button
        className="dashed row"
        style={{ background: 'transparent', color: 'var(--text)', textAlign: 'left' }}
        onClick={async () => {
          const ask = `Elimde şunlar var: ${haveNames.join(', ') || '(listeyi yaz)'}. Bunlarla yapabileceğim bir tarif öner.\n\n${AI_PROMPT}`;
          show((await copyText(ask)) ? 'Soru kopyalandı, yapay zekâya yapıştır.' : 'Kopyalanamadı.');
        }}
      >
        <Icon name="chat" />
        <span className="small" style={{ lineHeight: 1.45 }}><b>Uygun tarif yoksa</b> bu listeyle yapay zekâya sor: soruyu kopyala, gelen cevabı “Yeni tarif”e yapıştır.</span>
      </button>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
