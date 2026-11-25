import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useLibrary, useSessionState, plateKey, type PlateState } from '../lib/hooks';
import { defaultEaten, eatenFraction, f1, forGrams, kcal, recipeTotals, scale, unitName } from '../lib/nutrition';
import { sortAttempts, stats } from '../lib/score';
import { deleteRecipe, setBest } from '../lib/repo';
import { deletePhoto } from '../lib/photos';
import { Badges } from '../components/Badges';
import { PhotoPicker, PhotoView } from '../components/Photo';
import { Icon } from '../components/Icon';
import type { Attempt, Ingredient, Recipe } from '../types';

export function stepFor(usual: number): number {
  return usual >= 100 ? 10 : usual >= 20 ? 5 : 1;
}

export function dateText(a: Attempt): string {
  if (!a.tarih) return 'Tarih yok';
  return new Date(a.tarih + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function RecipeDetail() {
  const { id = '' } = useParams();
  const recipe = useLiveQuery(async () => (await db.recipes.get(id)) ?? null, [id]);
  const attempts = useLiveQuery(() => db.attempts.where('recipeId').equals(id).toArray(), [id]);
  const lib = useLibrary();
  const [plate, setPlate] = useSessionState<PlateState>(plateKey(id), { grams: {}, eaten: 0 });
  const nav = useNavigate();

  if (recipe === null) {
    return <div className="page"><p className="muted">Tarif bulunamadı. <Link to="/">Galeriye dön</Link></p></div>;
  }
  if (!recipe || !attempts || !lib) return null;

  const st = stats(attempts);
  const sorted = sortAttempts(attempts);
  const eaten = plate.eaten || defaultEaten(recipe);
  const whole = recipeTotals(recipe, lib, plate.grams);
  const usualWhole = recipeTotals(recipe, lib);
  const mine = scale(whole, eatenFraction(recipe, eaten));
  const unit = unitName(recipe);
  const unitStep = recipe.birim && recipe.birimAdet ? 1 : 0.5;
  const setGram = (ingId: string, g: number) => setPlate({ ...plate, eaten, grams: { ...plate.grams, [ingId]: Math.max(0, Math.round(g * 10) / 10) } });
  const changed = Object.entries(plate.grams).some(([k, g]) => recipe.malzemeler.find((m) => m.ingId === k)?.gram !== g);
  const diff = Math.round(whole.kcal - usualWhole.kcal);
  const cover = recipe.kapakFotoId ?? sorted.find((a) => a.fotoId)?.fotoId;

  return (
    <div className="page wide" style={{ paddingTop: 0 }}>
      <div className="detail-grid">
        <div className="stack" style={{ gap: 24 }}>
          <div className="hero" style={{ marginInline: -16 }}>
            <PhotoView id={cover} empty="kapak fotoğrafı ekle" />
            <div className="top">
              <button className="icon-btn" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="Geri"><Icon name="back" /></button>
              <div className="row">
                <PhotoPicker
                  className="btn sm"
                  label="Kapak"
                  onPicked={async (pid) => {
                    await deletePhoto(recipe.kapakFotoId);
                    await db.recipes.update(recipe.id, { kapakFotoId: pid, updatedAt: Date.now() });
                  }}
                />
                <Link className="icon-btn" to={`/tarif/${recipe.id}/duzenle`} aria-label="Tarifi düzenle"><Icon name="edit" /></Link>
              </div>
            </div>
            <div className="over scrim" style={{ paddingTop: 80 }}>
              <span className="lab gold">{[recipe.kategori, recipe.sureDk ? `${recipe.sureDk} dk` : null, recipe.birim && recipe.birimAdet ? `${recipe.birimAdet} ${recipe.birim}` : `${recipe.porsiyon} porsiyon`, recipe.kaynak].filter(Boolean).join(' · ')}</span>
              <h1 className="sf" style={{ fontSize: 50, lineHeight: 0.95 }}>{recipe.ad}</h1>
              <div className="row">
                <span className="sf gold" style={{ fontSize: 34, lineHeight: 1 }}>{st.avg == null ? '–' : st.avg.toFixed(1).replace('.', ',')}</span>
                <span className="small" style={{ color: 'var(--soft)', lineHeight: 1.35 }}>
                  {st.avg == null ? 'henüz puan yok' : 'ortalaman'}<br />{st.count} deneme{st.rated ? ' · ' + attempts.filter((a) => a.puan != null).map((a) => a.puan).join(' · ') : ''}
                </span>
                <div className="row" style={{ marginLeft: 'auto', gap: 4 }}>
                  {sorted.filter((a) => a.fotoId).slice(0, 3).map((a) => <PhotoView key={a.id} id={a.fotoId} thumb style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--line2)' }} />)}
                </div>
              </div>
            </div>
          </div>

          <div className="mobile-only"><Badges t={mine} label="tabağın" /></div>

          {recipe.etiketler.length > 0 && <div className="row wrap" style={{ gap: 6 }}>{recipe.etiketler.map((t) => <span key={t} className="tag">{t}</span>)}</div>}

          <div className="mobile-only">
            <Portion recipe={recipe} lib={lib} plate={plate} eaten={eaten} unit={unit} unitStep={unitStep} setPlate={setPlate} setGram={setGram} changed={changed} diff={diff} wholeKcal={whole.kcal} wholeGram={whole.gram} />
          </div>

          <section className="stack" style={{ gap: 14 }}>
            <h2 className="h2">Yapılış</h2>
            <div className="steps">
              {recipe.adimlar.map((s, i) => (
                <FragmentStep key={i} n={i + 1} metin={s.metin} sure={s.sureDk} derece={s.derece} />
              ))}
            </div>
            {recipe.notlar && <p className="notice" style={{ margin: 0 }}>{recipe.notlar}</p>}
          </section>

          <section className="stack" style={{ gap: 12 }}>
            <div className="between"><h2 className="h2">Denemeler</h2><span className="small muted">en yeni üstte</span></div>
            {sorted.length === 0 && <p className="dashed muted small" style={{ margin: 0 }}>Henüz kayıt yok. Pişirince puanla, notlarını yaz.</p>}
            {sorted.map((a) => (
              <AttemptCard key={a.id} a={a} recipe={recipe} lib={lib} onUse={a.gramlar ? () => setPlate({ ...plate, eaten: a.yenen || eaten, grams: { ...a.gramlar } }) : undefined} />
            ))}
          </section>

          <div className="row wrap">
            <Link className="btn gold grow" to={`/tarif/${recipe.id}/pisir`}><Icon name="play" size={16} fill />Pişirme modu</Link>
            <Link className="btn" to={`/tarif/${recipe.id}/puanla`}><Icon name="star" size={16} />Pişirdim, puanla</Link>
            <button
              className="btn danger"
              onClick={async () => {
                if (confirm(`“${recipe.ad}” ve bütün denemeleri silinsin mi?`)) {
                  await deleteRecipe(recipe.id);
                  nav('/');
                }
              }}
            >
              <Icon name="trash" size={16} />Sil
            </button>
          </div>
        </div>

        <div className="aside desktop-only stack" style={{ gap: 20, paddingTop: 28 }}>
          <Badges t={mine} label="tabağın" />
          <Portion recipe={recipe} lib={lib} plate={plate} eaten={eaten} unit={unit} unitStep={unitStep} setPlate={setPlate} setGram={setGram} changed={changed} diff={diff} wholeKcal={whole.kcal} wholeGram={whole.gram} />
        </div>
      </div>
    </div>
  );
}

function FragmentStep({ n, metin, sure, derece }: { n: number; metin: string; sure?: number | null; derece?: number | null }) {
  return (
    <>
      <span className="n">{String(n).padStart(2, '0')}</span>
      <span>
        {metin}
        {(sure || derece) && (
          <span className="row" style={{ gap: 6, marginTop: 6 }}>
            {sure ? <span className="tag"><Icon name="clock" size={12} /> {sure} dk</span> : null}
            {derece ? <span className="tag">{derece} °C</span> : null}
          </span>
        )}
      </span>
    </>
  );
}

interface PortionProps {
  recipe: Recipe;
  lib: Map<string, Ingredient>;
  plate: PlateState;
  eaten: number;
  unit: string;
  unitStep: number;
  setPlate: (p: PlateState) => void;
  setGram: (ingId: string, g: number) => void;
  changed: boolean;
  diff: number;
  wholeKcal: number;
  wholeGram: number;
}

function Portion({ recipe, lib, plate, eaten, unit, unitStep, setPlate, setGram, changed, diff, wholeKcal, wholeGram }: PortionProps) {
  const multi = recipe.porsiyon > 1 || !!recipe.birimAdet;
  return (
    <section className="card stack" style={{ gap: 4 }}>
      <div className="between" style={{ marginBottom: 4 }}>
        <div className="stack" style={{ gap: 2 }}>
          <h2 className="h2">Porsiyonum</h2>
          <span className="small muted">bu sefer kaç gram koydun?{multi ? ' (bütün tarif için)' : ''}</span>
        </div>
        <button className="btn sm" disabled={!changed} onClick={() => setPlate({ grams: {}, eaten })}>Her zamanki</button>
      </div>
      {recipe.malzemeler.map((m) => {
        const ing = lib.get(m.ingId);
        if (!ing) return null;
        const g = m.ingId in plate.grams ? plate.grams[m.ingId] : m.gram;
        const d = Math.round((g - m.gram) * 10) / 10;
        const step = stepFor(m.gram);
        return (
          <div key={m.ingId} className="ing-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            <div className="between" style={{ alignItems: 'baseline' }}>
              <span style={{ fontSize: 15 }}>{ing.ad}</span>
              <span className="pill" style={{ minWidth: 58, textAlign: 'center' }}>{kcal(forGrams(ing, g).kcal)} kcal</span>
            </div>
            <div className="between">
              <span className="small muted grow" style={{ lineHeight: 1.35 }}>
                100 g = {kcal(ing.kcal)} kcal · <span style={{ color: d ? 'var(--gold)' : undefined }}>{d === 0 ? 'her zamanki' : `${d > 0 ? '+' : ''}${String(d).replace('.', ',')} g`}</span>
                {m.not ? <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.not}>{m.not}</span> : null}
              </span>
              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                <button className="stp" aria-label={`${ing.ad} azalt`} onClick={() => setGram(m.ingId, g - step)}>−</button>
                <input
                  className={`gram-in${d ? ' changed' : ''}`}
                  inputMode="decimal"
                  aria-label={`${ing.ad} gram`}
                  value={String(g).replace('.', ',')}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(',', '.'));
                    if (Number.isFinite(v)) setGram(m.ingId, v);
                  }}
                />
                <button className="stp" aria-label={`${ing.ad} artır`} onClick={() => setGram(m.ingId, g + step)}>+</button>
              </div>
            </div>
          </div>
        );
      })}
      <div className="between small" style={{ paddingTop: 10, color: 'var(--soft)' }}>
        <span>Bütün tarif {Math.round(wholeGram)} g{diff ? ` · her zamankinden ${diff > 0 ? '+' : ''}${diff} kcal` : ''}</span>
        <span className="pill" style={{ fontSize: 14 }}>{kcal(wholeKcal)} kcal</span>
      </div>
      {multi && (
        <div className="between" style={{ paddingTop: 12, marginTop: 6, borderTop: '1px solid var(--line)' }}>
          <span>Yediğim</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="stp" aria-label="Azalt" onClick={() => setPlate({ ...plate, eaten: Math.max(unitStep, eaten - unitStep) })}>−</button>
            <span className="sf" style={{ fontSize: 24, minWidth: 90, textAlign: 'center' }}>{String(eaten).replace('.', ',')} {unit}</span>
            <button className="stp" aria-label="Artır" onClick={() => setPlate({ ...plate, eaten: eaten + unitStep })}>+</button>
          </div>
        </div>
      )}
    </section>
  );
}

function AttemptCard({ a, recipe, lib, onUse }: { a: Attempt; recipe: Recipe; lib: Map<string, Ingredient>; onUse?: () => void }) {
  const t = a.gramlar ? scale(recipeTotals(recipe, lib, a.gramlar), eatenFraction(recipe, a.yenen || defaultEaten(recipe))) : null;
  const meta = [a.yontem, a.derece ? `${a.derece} °C` : null, a.sureDk ? `${a.sureDk} dk` : null].filter(Boolean).join(' · ');
  return (
    <div className={`attempt${a.enIyi ? ' best' : ''}`}>
      <PhotoView id={a.fotoId} thumb />
      <div className="stack" style={{ gap: 5 }}>
        <div className="between" style={{ alignItems: 'baseline' }}>
          <span className="lab" style={{ color: a.enIyi ? 'var(--gold)' : undefined }}>{dateText(a)}{a.enIyi ? ' · en iyi versiyon' : ''}</span>
          <span className="sf" style={{ fontSize: 28, lineHeight: 1 }}>{a.puan ?? '–'}</span>
        </div>
        {(meta || t) && (
          <span className="row wrap small muted" style={{ gap: 6 }}>
            {meta}
            {t && <span className="pill">{kcal(t.kcal)} kcal</span>}
          </span>
        )}
        {a.not && <span className="sf it" style={{ fontSize: 18, lineHeight: 1.28 }}>“{a.not}”</span>}
        <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
          <button className="btn sm" onClick={() => setBest(a)}><Icon name="star" size={14} fill={!!a.enIyi} />{a.enIyi ? 'En iyi' : 'En iyi yap'}</button>
          {onUse && <button className="btn sm" onClick={onUse}>Bu gramları kullan</button>}
          <button
            className="btn sm danger"
            aria-label="Denemeyi sil"
            onClick={async () => {
              if (confirm('Bu deneme silinsin mi?')) {
                await deletePhoto(a.fotoId);
                await db.attempts.delete(a.id);
              }
            }}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
        {t && <span className="small muted">P {f1(t.protein)} · K {f1(t.karb)} · Y {f1(t.yag)}</span>}
      </div>
    </div>
  );
}
