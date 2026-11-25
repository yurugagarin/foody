import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useGoBack, useLibrary, usePlate } from '../lib/hooks';
import { portionOf, recipeTotals, parseNum } from '../lib/nutrition';
import { stats } from '../lib/score';
import { addAttempt } from '../lib/repo';
import { YONTEMLER, type AttemptDraft } from '../types';
import { Badges } from '../components/Badges';
import { PhotoPicker, PhotoView } from '../components/Photo';
import { Icon } from '../components/Icon';

const WORDS = ['', 'olmadı', 'olmadı', 'olmadı', 'idare eder', 'idare eder', 'güzel', 'güzel', 'çok iyi', 'çok iyi', 'efsane'];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function RateAttempt() {
  const { id = '' } = useParams();
  const recipe = useLiveQuery(() => db.recipes.get(id), [id]);
  const attempts = useLiveQuery(() => db.attempts.where('recipeId').equals(id).toArray(), [id]);
  const lib = useLibrary();
  const [plate, setPlate] = usePlate(id);
  const [saving, setSaving] = useState(false);
  const goBack = useGoBack();

  if (!recipe || !attempts || !lib || !plate) return null;
  // Everything in this form is saved on the device as it is typed.
  const dr: AttemptDraft = { score: 8, rated: true, method: '', temp: '', time: '', date: today(), makeDefault: false, best: false, ...plate.taslak };
  const upd = (p: Partial<AttemptDraft>) => setPlate({ ...plate, taslak: { ...dr, ...p } });
  const { score, rated, method, temp, time, date, foto, makeDefault, best } = dr;
  const setScore = (score: number) => upd({ score });
  const setRated = (rated: boolean) => upd({ rated });
  const setMethod = (method: string) => upd({ method });
  const setTemp = (temp: string) => upd({ temp });
  const setTime = (time: string) => upd({ time });
  const setDate = (date: string) => upd({ date });
  const setFoto = (foto: string) => upd({ foto });
  const setMakeDefault = (makeDefault: boolean) => upd({ makeDefault });
  const setBest = (best: boolean) => upd({ best });
  const st = stats(attempts);
  const ratedList = attempts.filter((a) => a.puan != null).map((a) => a.puan as number);
  const newAvg = rated ? (ratedList.reduce((s, x) => s + x, 0) + score) / (ratedList.length + 1) : st.avg;
  const parts = plate.parts || recipe.porsiyon || 1;
  const t = portionOf(recipeTotals(recipe, lib, plate.grams), parts);
  const changes = recipe.malzemeler
    .filter((m) => m.ingId in plate.grams && plate.grams[m.ingId] !== m.gram)
    .map((m) => {
      const d = plate.grams[m.ingId] - m.gram;
      return `${lib.get(m.ingId)?.ad} ${d > 0 ? '+' : ''}${String(Math.round(d * 10) / 10).replace('.', ',')} g`;
    });
  const noteValue = plate.note ?? '';

  const save = async () => {
    setSaving(true);
    const gramlar = Object.fromEntries(recipe.malzemeler.map((m) => [m.ingId, m.ingId in plate.grams ? plate.grams[m.ingId] : m.gram]));
    const d = parseNum(temp);
    const s = parseNum(time);
    await addAttempt(
      {
        recipeId: recipe.id,
        tarih: date || null,
        puan: rated ? score : null,
        yontem: method || undefined,
        derece: Number.isFinite(d) ? d : null,
        sureDk: Number.isFinite(s) ? s : null,
        not: noteValue.trim() || undefined,
        fotoId: foto,
        gramlar,
        bolum: parts,
        pismisGram: plate.cooked ?? null,
        enIyi: best
      },
      { makeDefault }
    );
    // The grams stay in Porsiyonum (and are saved with the attempt); only the note is done.
    setPlate(makeDefault ? { grams: {}, cooked: plate.cooked } : { ...plate, note: '', taslak: undefined });
    goBack(`/tarif/${recipe.id}`);
  };

  return (
    <div className="page">
      <header className="between">
        <button className="icon-btn" onClick={() => goBack(`/tarif/${recipe.id}`)} aria-label="Kapat"><Icon name="close" /></button>
        <span className="lab">{st.count + 1}. deneme</span>
        <span style={{ width: 44 }} />
      </header>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small muted">{recipe.ad}</span>
        <h1 className="h1">Afiyet olsun.<br /><span className="it gold">Nasıldı?</span></h1>
      </div>

      <section className="stack" style={{ gap: 6 }}>
        <div className="between" style={{ alignItems: 'flex-end' }}>
          <span className="sf gold" style={{ fontSize: 120, lineHeight: 0.8, opacity: rated ? 1 : 0.3 }}>{score}</span>
          <div className="stack" style={{ alignItems: 'flex-end', gap: 4, paddingBottom: 6 }}>
            <span className="sf it" style={{ fontSize: 24 }}>{rated ? WORDS[score] : 'puansız'}</span>
            <span className="small muted">ortalama {st.avg == null ? '–' : st.avg.toFixed(1).replace('.', ',')} → {newAvg == null ? '–' : newAvg.toFixed(1).replace('.', ',')}</span>
          </div>
        </div>
        <label className="lab" htmlFor="puan">Puan · 1–10</label>
        <input id="puan" type="range" min={1} max={10} step={1} value={score} disabled={!rated} onChange={(e) => setScore(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--gold)', height: 32 }} />
        <div className="between small muted"><span>1 olmadı</span><span>5 idare eder</span><span>10 efsane</span></div>
        <label className="row small" style={{ minHeight: 40 }}>
          <input type="checkbox" checked={!rated} onChange={(e) => setRated(!e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--gold)' }} />
          Puan vermeden kaydet
        </label>
      </section>

      <section className="card stack">
        <span className="lab">Bu sefer 1 porsiyon · {parts} porsiyona böldün</span>
        <Badges t={t} size="md" />
        <span className="small muted">{changes.length ? `Her zamankinden farkı: ${changes.join(', ')}` : 'Her zamanki gramlar.'} <button onClick={() => goBack(`/tarif/${recipe.id}`)} style={{ background: 'none', border: 0, padding: 0, color: 'var(--gold)', textDecoration: 'underline', fontSize: 'inherit' }}>Gramları değiştir</button></span>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <span className="lab">Nasıl pişirdin?</span>
        <div className="row wrap" style={{ gap: 6 }}>
          {YONTEMLER.map((m) => <button key={m} className={`chip${method === m ? ' on' : ''}`} onClick={() => setMethod(method === m ? '' : m)}>{m}</button>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <label className="field"><span className="lab">Derece °C</span><input className="input" inputMode="numeric" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="—" /></label>
          <label className="field"><span className="lab">Süre · dk</span><input className="input" inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value)} placeholder="—" /></label>
          <label className="field"><span className="lab">Tarih</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
      </section>

      <label className="field">
        <span className="lab">Notların · ne değişti, ne daha iyi oldu?</span>
        <textarea className="textarea sf it" rows={4} style={{ fontSize: 20, lineHeight: 1.3 }} value={noteValue} onChange={(e) => setPlate({ ...plate, note: e.target.value })} placeholder="Örn. airfryer'da 160 °C'de 14 dk, daha iyi oldu." />
      </label>

      <section className="row" style={{ gap: 14 }}>
        {foto ? <PhotoView id={foto} thumb style={{ width: 92, height: 92, borderRadius: 18 }} /> : <PhotoPicker className="icon-btn" iconOnly label="Bu seferin fotoğrafı" onPicked={setFoto} />}
        <div className="stack" style={{ gap: 4 }}>
          <span>Bu seferin fotoğrafı</span>
          {foto ? <PhotoPicker className="btn sm" label="Değiştir" onPicked={setFoto} /> : <span className="small muted">Galeride en yeni fotoğraf görünür.</span>}
        </div>
      </section>

      <div className="stack" style={{ gap: 4 }}>
        <label className="row small" style={{ minHeight: 44, color: 'var(--soft)' }}>
          <input type="checkbox" checked={best} onChange={(e) => setBest(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--gold)' }} />
          Bunu “en iyi versiyon” yap
        </label>
        {(changes.length > 0 || parts !== recipe.porsiyon) && (
          <label className="row small" style={{ minHeight: 44, color: 'var(--soft)' }}>
            <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--gold)' }} />
            Bu gramları ve porsiyon sayısını bir dahakine varsayılan yap
          </label>
        )}
        <button className="btn gold" style={{ height: 60, fontSize: 17 }} disabled={saving} onClick={save}>Denemeyi kaydet</button>
      </div>
    </div>
  );
}
