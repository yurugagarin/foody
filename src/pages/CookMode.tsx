import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { cookNoteKey, plateKey, useLibrary, useSessionState, type PlateState } from '../lib/hooks';
import { Icon } from '../components/Icon';

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export function CookMode() {
  const { id = '' } = useParams();
  const recipe = useLiveQuery(() => db.recipes.get(id), [id]);
  const lib = useLibrary();
  const [plate] = useSessionState<PlateState>(plateKey(id), { grams: {} });
  const [note, setNote] = useSessionState<string>(cookNoteKey(id), '');
  const [i, setI] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showIngs, setShowIngs] = useState(false);
  const nav = useNavigate();
  const total = useRef(0);

  // Keep the screen on while cooking.
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    const get = async () => {
      try {
        lock = await navigator.wakeLock?.request('screen');
      } catch {
        /* not supported */
      }
    };
    void get();
    const vis = () => document.visibilityState === 'visible' && get();
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      void lock?.release();
    };
  }, []);

  const step = recipe?.adimlar[i];
  useEffect(() => {
    const s = step?.sureDk ? step.sureDk * 60 : null;
    total.current = s ?? 0;
    setLeft(s);
    setRunning(false);
  }, [i, step?.sureDk]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLeft((l) => {
        if (l == null) return l;
        if (l <= 1) {
          setRunning(false);
          navigator.vibrate?.([300, 150, 300]);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  if (!recipe || !lib) return null;
  const n = recipe.adimlar.length;
  if (!n) return <div className="cook"><p>Bu tarifte adım yok. <Link to={`/tarif/${id}/duzenle`}>Adım ekle</Link></p></div>;
  const last = i === n - 1;
  const r = 70;
  const c = 2 * Math.PI * r;
  const frac = left != null && total.current ? 1 - left / total.current : 0;

  return (
    <div className="cook">
      <header className="between">
        <Link to={`/tarif/${id}`} className="icon-btn" aria-label="Pişirme modundan çık"><Icon name="close" /></Link>
        <span className="lab">Adım {i + 1} / {n}</span>
        <button className="btn sm" onClick={() => setShowIngs(!showIngs)}>Malzemeler</button>
      </header>
      <div className="bars" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {recipe.adimlar.map((_, k) => <span key={k} className={k < i ? 'done' : k === i ? 'cur' : ''} />)}
      </div>

      {showIngs && (
        <div className="card row wrap" style={{ gap: 6 }}>
          {recipe.malzemeler.map((m) => {
            const ing = lib.get(m.ingId);
            const g = m.ingId in plate.grams ? plate.grams[m.ingId] : m.gram;
            return ing ? <span key={m.ingId} className="tag" style={{ fontSize: 13 }}>{ing.ad} <b className="gold">{String(g).replace('.', ',')} g</b></span> : null;
          })}
        </div>
      )}

      <p className="text">{step?.metin}</p>
      {step?.derece ? <span className="tag" style={{ alignSelf: 'flex-start', fontSize: 14 }}>{step.derece} °C</span> : null}

      {left != null && (
        <div className="row" style={{ gap: 22 }}>
          <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
            <svg width="150" height="150" viewBox="0 0 160 160" role="img" aria-label={`Zamanlayıcı: ${mmss(left)} kaldı`}>
              <circle cx="80" cy="80" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
              <circle cx="80" cy="80" r={r} fill="none" stroke="var(--gold)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${frac * c} ${c}`} transform="rotate(-90 80 80)" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span className="sf" style={{ fontSize: 44, lineHeight: 1, color: left === 0 ? 'var(--gold)' : undefined }}>{mmss(left)}</span>
              <span className="lab">/ {mmss(total.current)}</span>
            </div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <button className="btn" style={{ background: 'var(--text)', color: 'var(--bg)', fontWeight: 600 }} onClick={() => setRunning(!running)} disabled={left === 0}>
              <Icon name={running ? 'pause' : 'play'} size={14} fill />{running ? 'Duraklat' : 'Başlat'}
            </button>
            <button className="btn" onClick={() => { total.current += 60; setLeft((l) => (l ?? 0) + 60); }}>+1 dakika</button>
          </div>
        </div>
      )}

      <button className="btn sm" style={{ alignSelf: 'flex-start', borderStyle: 'dashed', borderColor: 'var(--gold)', color: 'var(--gold)' }} onClick={() => setShowNote(!showNote)}>
        <Icon name="edit" size={14} />Not düş
      </button>
      {showNote && (
        <label className="field">
          <span className="sr">Pişirirken notun</span>
          <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ne değiştirdin? Kaç derece, kaç dakika?" />
          <span className="small muted">Bitince puanlama ekranına kendiliğinden gelir.</span>
        </label>
      )}

      <div className="grow" />
      {!last && (
        <div className="stack" style={{ gap: 6, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <span className="lab">Sıradaki</span>
          <span style={{ fontWeight: 300 }}>{recipe.adimlar[i + 1].metin}</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 10 }}>
        <button className="btn" style={{ height: 64, padding: 0 }} aria-label="Önceki adım" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="back" /></button>
        {last ? (
          <button className="btn gold" style={{ height: 64, fontSize: 17 }} onClick={() => nav(`/tarif/${id}/puanla`)}>Bitti, puanla<Icon name="star" /></button>
        ) : (
          <button className="btn gold" style={{ height: 64, fontSize: 17 }} onClick={() => setI(i + 1)}>Sonraki adım<Icon name="next" /></button>
        )}
      </div>
    </div>
  );
}
