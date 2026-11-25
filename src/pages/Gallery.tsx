import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLibrary, useRecipes, type RecipeWithStats } from '../lib/hooks';
import { perPortion, normName } from '../lib/nutrition';
import { agoText, daysSince, weight, weightedPick } from '../lib/score';
import { Brand } from '../components/Logo';
import { Icon } from '../components/Icon';
import { KcalDot } from '../components/Badges';
import { PhotoView } from '../components/Photo';
import type { Ingredient } from '../types';

type Sort = 'sana' | 'puan' | 'kalori' | 'yeni';

function score(avg: number | null): string {
  return avg == null ? '–' : avg.toFixed(1).replace('.', ',');
}

function coverId(r: RecipeWithStats): string | undefined {
  return r.recipe.kapakFotoId ?? r.attempts.find((a) => a.fotoId)?.fotoId;
}

const HEIGHTS = [230, 170, 200, 250, 180];

export function Gallery() {
  const all = useRecipes();
  const lib = useLibrary();
  const [sort, setSort] = useState<Sort>('sana');
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [pickIdx, setPickIdx] = useState<number | null>(null);

  const weights = useMemo(() => (all ?? []).map((r) => weight(r.stats.avg, daysSince(r.stats.last ?? r.recipe.createdAt))), [all]);
  const pick = all && all.length ? all[pickIdx ?? Math.max(0, weights.indexOf(Math.max(...weights)))] : undefined;

  const cats = useMemo(() => Array.from(new Set((all ?? []).map((r) => r.recipe.kategori))).sort(), [all]);

  const list = useMemo(() => {
    if (!all || !lib) return [];
    const nq = normName(q);
    const filtered = all.filter((r) => {
      if (cat && r.recipe.kategori !== cat) return false;
      if (!nq) return true;
      const hay = [r.recipe.ad, r.recipe.kategori, ...r.recipe.etiketler, ...r.recipe.malzemeler.map((m) => lib.get(m.ingId)?.ad ?? '')].map(normName).join(' ');
      return hay.includes(nq);
    });
    const w = new Map(all.map((r, i) => [r.recipe.id, weights[i]]));
    const kc = (r: RecipeWithStats) => perPortion(r.recipe, lib).kcal;
    const sorters: Record<Sort, (a: RecipeWithStats, b: RecipeWithStats) => number> = {
      sana: (a, b) => w.get(b.recipe.id)! - w.get(a.recipe.id)!,
      puan: (a, b) => (b.stats.avg ?? -1) - (a.stats.avg ?? -1),
      kalori: (a, b) => kc(a) - kc(b),
      yeni: (a, b) => b.recipe.createdAt - a.recipe.createdAt
    };
    return filtered.slice().sort(sorters[sort]);
  }, [all, lib, q, cat, sort, weights]);

  if (!all || !lib) return null;

  return (
    <div className="page wide">
      <header className="between mobile-only">
        <Brand />
        <Link to="/yeni" className="btn sm"><Icon name="chat" size={16} />Yapıştır</Link>
      </header>
      <div className="between">
        <div className="stack" style={{ gap: 4 }}>
          <span className="lab">{all.length} tarif · {all.reduce((s, r) => s + r.stats.count, 0)} kez pişti</span>
          <h1 className="h1">Mutfağım</h1>
        </div>
      </div>

      {pick && (
        <section className="spot" aria-label="Bugün ne yesem?">
          <PhotoView id={coverId(pick)} empty="fotoğrafını tarife ekle" />
          <span className="lab" style={{ position: 'absolute', top: 16, left: 16, color: 'var(--gold)', background: 'rgba(15,14,13,0.6)', padding: '6px 10px', borderRadius: 99 }}>Bugün ne yesem?</span>
          <span style={{ position: 'absolute', top: 14, right: 14 }} className="rb kcal">
            <span style={{ width: 76, height: 76, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <b style={{ fontSize: 22 }}>{Math.round(perPortion(pick.recipe, lib).kcal)}</b>
              <small>KCAL</small>
            </span>
          </span>
          <div className="over scrim">
            <div className="between" style={{ alignItems: 'flex-end' }}>
              <h2 className="sf" style={{ fontSize: 38, lineHeight: 0.98 }}>{pick.recipe.ad}</h2>
              <span className="sf gold" style={{ fontSize: 38, lineHeight: 1 }}>{score(pick.stats.avg)}</span>
            </div>
            <span className="small" style={{ color: 'var(--soft)', fontWeight: 300 }}>
              {pick.stats.avg != null ? `Ortalaman ${score(pick.stats.avg)} · ` : 'Henüz puan yok · '}
              {pick.stats.count} kez yaptın · {agoText(pick.stats.last, undefined, pick.stats.count)}
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn" style={{ background: 'rgba(15,14,13,0.45)' }} onClick={() => setPickIdx(weightedPick(weights, all.indexOf(pick)))}>
                <Icon name="reroll" size={16} />Başka öner
              </button>
              <Link className="btn gold" to={`/tarif/${pick.recipe.id}`}>Bunu yapalım</Link>
            </div>
          </div>
        </section>
      )}

      <Link to="/dolap" className="dashed row" style={{ textDecoration: 'none', color: 'var(--text)' }}>
        <span className="icon-btn" style={{ borderColor: 'var(--gold)', color: 'var(--gold)', background: 'var(--panel)' }}><Icon name="fridge" /></span>
        <span className="grow stack" style={{ gap: 2 }}>
          <span className="sf it" style={{ fontSize: 22, lineHeight: 1 }}>Dolabımda ne var?</span>
          <span className="small muted">Elindekilerle hangi tarifini yapabilirsin</span>
        </span>
        <Icon name="next" />
      </Link>

      <div className="stack" style={{ gap: 10 }}>
        <label className="row input" style={{ borderRadius: 99 }}>
          <Icon name="search" size={16} />
          <span className="sr">Tariflerde ara</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tarif, malzeme ya da etiket ara" style={{ border: 0, outline: 0, background: 'transparent', flex: 1, minWidth: 0, fontSize: 15, color: 'var(--text)' }} />
        </label>
        <div className="tabs" role="tablist">
          {([['sana', 'Sana göre'], ['puan', 'En yüksek puan'], ['kalori', 'Düşük kalori'], ['yeni', 'En yeni']] as [Sort, string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={sort === k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{l}</button>
          ))}
        </div>
        {cats.length > 1 && (
          <div className="row wrap" style={{ gap: 6 }}>
            <button className={`chip${cat == null ? ' on' : ''}`} onClick={() => setCat(null)}>Hepsi</button>
            {cats.map((c) => <button key={c} className={`chip${cat === c ? ' on' : ''}`} onClick={() => setCat(cat === c ? null : c)}>{c}</button>)}
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div className="dashed muted" style={{ textAlign: 'center', padding: 30 }}>
          {all.length === 0 ? <>Henüz tarif yok. <Link to="/yeni">İlk tarifini ekle</Link>.</> : 'Aramana uyan tarif yok.'}
        </div>
      ) : (
        <div className="masonry">
          {list.map((r, i) => (
            <TileView key={r.recipe.id} r={r} lib={lib} h={HEIGHTS[i % HEIGHTS.length]} />
          ))}
        </div>
      )}
    </div>
  );
}

function TileView({ r, lib, h }: { r: RecipeWithStats; lib: Map<string, Ingredient>; h: number }) {
  return (
    <Link to={`/tarif/${r.recipe.id}`} className="tile">
      <PhotoView id={coverId(r)} thumb style={{ height: h }} empty={r.recipe.ad.charAt(0)} />
      <span className="score"><span className="gold">★</span> {score(r.stats.avg)}</span>
      <KcalDot value={perPortion(r.recipe, lib).kcal} />
      <div className="cap scrim">
        <span className="sf" style={{ fontSize: 22, lineHeight: 1.02 }}>{r.recipe.ad}</span>
        <span className="small muted">{r.stats.count} kez · {agoText(r.stats.last, undefined, r.stats.count)}</span>
      </div>
    </Link>
  );
}
