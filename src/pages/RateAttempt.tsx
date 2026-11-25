import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useGoBack, useLibrary, usePlate } from '../lib/hooks';
import { portionOf, recipeTotals, parseNum } from '../lib/nutrition';
import { addAttempt, updateAttempt } from '../lib/repo';
import { YONTEMLER, type Attempt, type AttemptDraft, type Recipe } from '../types';
import { Badges } from '../components/Badges';
import { PhotoPicker, PhotoView } from '../components/Photo';
import { Icon } from '../components/Icon';
import { dateText } from './RecipeDetail';

const WORDS = ['', 'olmadı', 'olmadı', 'olmadı', 'idare eder', 'idare eder', 'güzel', 'güzel', 'çok iyi', 'çok iyi', 'efsane'];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const fmt = (x: number | null) => (x == null ? '–' : x.toFixed(1).replace('.', ','));
const numOrNull = (s: string) => (Number.isFinite(parseNum(s)) ? parseNum(s) : null);

/** Average of the other attempts' scores, and what it becomes with this score. */
function averages(others: Attempt[], dr: AttemptDraft): [number | null, number | null] {
  const list = others.filter((a) => a.puan != null).map((a) => a.puan as number);
  const now = list.length ? list.reduce((s, x) => s + x, 0) / list.length : null;
  const all = dr.rated ? [...list, dr.score] : list;
  return [now, all.length ? all.reduce((s, x) => s + x, 0) / all.length : null];
}

interface FormProps {
  recipe: Recipe;
  heading: ReactNode;
  label: string;
  dr: AttemptDraft;
  upd: (p: Partial<AttemptDraft>) => void;
  note: string;
  setNote: (s: string) => void;
  avgs: [number | null, number | null];
  portion: ReactNode;
  extra?: ReactNode;
  banner?: ReactNode;
  saveLabel: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}

/** The "how was it?" form, shared by a new cooking and by editing a saved one. */
function AttemptForm({ recipe, heading, label, dr, upd, note, setNote, avgs, portion, extra, banner, saveLabel, saving, onClose, onSave }: FormProps) {
  const { score, rated, method, temp, time, date, foto, best } = dr;
  return (
    <div className="page">
      <header className="between">
        <button className="icon-btn" onClick={onClose} aria-label="Kapat"><Icon name="close" /></button>
        <span className="lab">{label}</span>
        <span style={{ width: 44 }} />
      </header>
      {banner}
      <div className="stack" style={{ gap: 6 }}>
        <span className="small muted">{recipe.ad}</span>
        <h1 className="h1">{heading}</h1>
      </div>

      <section className="stack" style={{ gap: 6 }}>
        <div className="between" style={{ alignItems: 'flex-end' }}>
          <span className="sf gold" style={{ fontSize: 120, lineHeight: 0.8, opacity: rated ? 1 : 0.3 }}>{rated ? score : '–'}</span>
          <div className="stack" style={{ alignItems: 'flex-end', gap: 4, paddingBottom: 6 }}>
            <span className="sf it" style={{ fontSize: 24 }}>{rated ? WORDS[score] : 'puansız · çubuğu kaydır'}</span>
            <span className="small muted">ortalama {fmt(avgs[0])} → {fmt(avgs[1])}</span>
          </div>
        </div>
        <label className="lab" htmlFor="puan">Puan · 1–10</label>
        <input id="puan" type="range" min={1} max={10} step={1} value={score} onChange={(e) => upd({ score: Number(e.target.value), rated: true })} style={{ width: '100%', accentColor: 'var(--gold)', height: 32 }} />
        <div className="between small muted"><span>1 olmadı</span><span>5 idare eder</span><span>10 efsane</span></div>
        <label className="row small" style={{ minHeight: 40 }}>
          <input type="checkbox" checked={!rated} onChange={(e) => upd({ rated: !e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--gold)' }} />
          Puan vermeden kaydet
        </label>
      </section>

      {portion}

      <section className="stack" style={{ gap: 10 }}>
        <span className="lab">Nasıl pişirdin?</span>
        <div className="row wrap" style={{ gap: 6 }}>
          {YONTEMLER.map((m) => <button key={m} className={`chip${method === m ? ' on' : ''}`} onClick={() => upd({ method: method === m ? '' : m })}>{m}</button>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <label className="field"><span className="lab">Derece °C</span><input className="input" inputMode="numeric" value={temp} onChange={(e) => upd({ temp: e.target.value })} placeholder="—" /></label>
          <label className="field"><span className="lab">Süre · dk</span><input className="input" inputMode="numeric" value={time} onChange={(e) => upd({ time: e.target.value })} placeholder="—" /></label>
          <label className="field"><span className="lab">Tarih</span><input className="input" type="date" value={date} onChange={(e) => upd({ date: e.target.value })} /></label>
        </div>
      </section>

      <label className="field">
        <span className="lab">Notların · ne değişti, ne daha iyi oldu?</span>
        <textarea className="textarea sf it" rows={4} style={{ fontSize: 20, lineHeight: 1.3 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. limon suyu fazla geldi, bir dahakine yarısı." />
      </label>

      <section className="row" style={{ gap: 14 }}>
        {foto ? <PhotoView id={foto} thumb style={{ width: 92, height: 92, borderRadius: 18 }} /> : <PhotoPicker className="icon-btn" iconOnly label="Bu seferin fotoğrafı" onPicked={(f) => upd({ foto: f })} />}
        <div className="stack" style={{ gap: 4 }}>
          <span>Bu seferin fotoğrafı</span>
          {foto ? <PhotoPicker className="btn sm" label="Değiştir" onPicked={(f) => upd({ foto: f })} /> : <span className="small muted">Galeride en yeni fotoğraf görünür.</span>}
        </div>
      </section>

      <div className="stack" style={{ gap: 4 }}>
        <label className="row small" style={{ minHeight: 44, color: 'var(--soft)' }}>
          <input type="checkbox" checked={best} onChange={(e) => upd({ best: e.target.checked })} style={{ width: 22, height: 22, accentColor: 'var(--gold)' }} />
          Bunu “en iyi versiyon” yap
        </label>
        {extra}
        <button className="btn gold" style={{ height: 60, fontSize: 17 }} disabled={saving} onClick={onSave}>{saveLabel}</button>
      </div>
    </div>
  );
}

/** "Pişirdim, puanla": a new attempt from today's grams. */
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
  const parts = plate.parts || recipe.porsiyon || 1;
  const t = portionOf(recipeTotals(recipe, lib, plate.grams), parts);
  const changes = recipe.malzemeler
    .filter((m) => m.ingId in plate.grams && plate.grams[m.ingId] !== m.gram)
    .map((m) => {
      const d = plate.grams[m.ingId] - m.gram;
      return `${lib.get(m.ingId)?.ad} ${d > 0 ? '+' : ''}${String(Math.round(d * 10) / 10).replace('.', ',')} g`;
    });
  const note = plate.note ?? '';

  const save = async () => {
    setSaving(true);
    const gramlar = Object.fromEntries(recipe.malzemeler.map((m) => [m.ingId, m.ingId in plate.grams ? plate.grams[m.ingId] : m.gram]));
    await addAttempt(
      {
        recipeId: recipe.id,
        tarih: dr.date || null,
        puan: dr.rated ? dr.score : null,
        yontem: dr.method || undefined,
        derece: numOrNull(dr.temp),
        sureDk: numOrNull(dr.time),
        not: note.trim() || undefined,
        fotoId: dr.foto,
        gramlar,
        bolum: parts,
        pismisGram: plate.cooked ?? null,
        enIyi: dr.best
      },
      { makeDefault: dr.makeDefault }
    );
    // The grams stay in Porsiyonum (and are saved with the attempt); only the note is done.
    setPlate(dr.makeDefault ? { grams: {}, cooked: plate.cooked } : { ...plate, note: '', taslak: undefined });
    goBack(`/tarif/${recipe.id}`);
  };

  return (
    <AttemptForm
      recipe={recipe}
      label={`${attempts.length + 1}. deneme`}
      heading={<>Afiyet olsun.<br /><span className="it gold">Nasıldı?</span></>}
      dr={dr}
      upd={upd}
      note={note}
      setNote={(s) => setPlate({ ...plate, note: s })}
      avgs={averages(attempts, dr)}
      saving={saving}
      saveLabel="Denemeyi kaydet"
      onClose={() => goBack(`/tarif/${recipe.id}`)}
      onSave={save}
      portion={
        <section className="card stack">
          <span className="lab">Bu sefer 1 porsiyon · {parts} porsiyona böldün</span>
          <Badges t={t} size="md" />
          <span className="small muted">{changes.length ? `Her zamankinden farkı: ${changes.join(', ')}` : 'Her zamanki gramlar.'} <button onClick={() => goBack(`/tarif/${recipe.id}`)} style={{ background: 'none', border: 0, padding: 0, color: 'var(--gold)', textDecoration: 'underline', fontSize: 'inherit' }}>Gramları değiştir</button></span>
        </section>
      }
      extra={
        (changes.length > 0 || parts !== recipe.porsiyon) && (
          <label className="row small" style={{ minHeight: 44, color: 'var(--soft)' }}>
            <input type="checkbox" checked={dr.makeDefault} onChange={(e) => upd({ makeDefault: e.target.checked })} style={{ width: 22, height: 22, accentColor: 'var(--gold)' }} />
            Bu gramları ve porsiyon sayısını bir dahakine varsayılan yap
          </label>
        )
      }
    />
  );
}

const editKey = (attemptId: string) => `attemptEdit:${attemptId}`;

function draftFrom(a: Attempt): AttemptDraft {
  return {
    score: a.puan ?? 8,
    rated: a.puan != null,
    method: a.yontem ?? '',
    temp: a.derece != null ? String(a.derece) : '',
    time: a.sureDk != null ? String(a.sureDk) : '',
    date: a.tarih ?? '',
    foto: a.fotoId,
    makeDefault: false,
    best: !!a.enIyi,
    note: a.not ?? ''
  };
}

/** Editing a saved attempt: change the score, notes, photo… later. */
export function EditAttempt() {
  const { id = '', aid = '' } = useParams();
  const recipe = useLiveQuery(() => db.recipes.get(id), [id]);
  const attempts = useLiveQuery(() => db.attempts.where('recipeId').equals(id).toArray(), [id]);
  const lib = useLibrary();
  const [dr, setDr] = useState<AttemptDraft | null>(null);
  const [restored, setRestored] = useState(false);
  const [saving, setSaving] = useState(false);
  const goBack = useGoBack();
  const attempt = attempts?.find((a) => a.id === aid);

  useEffect(() => {
    if (!attempt || dr) return;
    void db.meta.get(editKey(aid)).then((d) => {
      if (d?.value) {
        setDr(d.value as AttemptDraft);
        setRestored(true);
      } else setDr(draftFrom(attempt));
    });
  }, [attempt, aid, dr]);

  if (attempts && !attempt) return <div className="page"><p className="muted">Bu deneme bulunamadı.</p></div>;
  if (!recipe || !attempts || !lib || !attempt || !dr) return null;

  // Every change is kept on the device until saved or discarded.
  const upd = (p: Partial<AttemptDraft>) => {
    const next = { ...dr, ...p };
    setDr(next);
    void db.meta.put({ key: editKey(aid), value: next });
  };
  const others = attempts.filter((a) => a.id !== aid);
  const t = attempt.gramlar ? portionOf(recipeTotals(recipe, lib, attempt.gramlar), attempt.bolum || recipe.porsiyon) : null;

  const save = async () => {
    setSaving(true);
    await updateAttempt(aid, {
      tarih: dr.date || null,
      puan: dr.rated ? dr.score : null,
      yontem: dr.method || undefined,
      derece: numOrNull(dr.temp),
      sureDk: numOrNull(dr.time),
      not: (dr.note ?? '').trim() || undefined,
      fotoId: dr.foto,
      enIyi: dr.best
    });
    await db.meta.delete(editKey(aid));
    goBack(`/tarif/${recipe.id}`);
  };

  return (
    <AttemptForm
      recipe={recipe}
      label={`Denemeyi düzenle · ${dateText(attempt)}`}
      heading={<>Fikrin<br /><span className="it gold">değişti mi?</span></>}
      dr={dr}
      upd={upd}
      note={dr.note ?? ''}
      setNote={(s) => upd({ note: s })}
      avgs={averages(others, dr)}
      saving={saving}
      saveLabel="Değişiklikleri kaydet"
      onClose={() => goBack(`/tarif/${recipe.id}`)}
      onSave={save}
      banner={
        restored && (
          <div className="notice between wrap">
            <span>Kaydetmediğin değişiklikler geri yüklendi.</span>
            <button className="btn sm" onClick={async () => {
              if (!confirm('Kaydetmediğin değişiklikler silinsin mi?')) return;
              await db.meta.delete(editKey(aid));
              setRestored(false);
              setDr(draftFrom(attempt));
            }}>Kayıtlı haline dön</button>
          </div>
        )
      }
      portion={
        t && (
          <section className="card stack">
            <span className="lab">O seferki 1 porsiyon · {attempt.bolum || recipe.porsiyon} porsiyona bölmüştün</span>
            <Badges t={t} size="md" />
          </section>
        )
      }
    />
  );
}
