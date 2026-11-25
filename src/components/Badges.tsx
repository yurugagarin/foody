import type { Totals } from '../lib/nutrition';
import { f1, kcal } from '../lib/nutrition';

/** The highlighted round kcal / protein / carb / fat badges. */
export function Badges({ t, size = 'lg', label }: { t: Pick<Totals, 'kcal' | 'protein' | 'karb' | 'yag'>; size?: 'lg' | 'md'; label?: string }) {
  return (
    <div className={`badges ${size}`} role="group" aria-label={label ? `${label}: ${kcal(t.kcal)} kcal` : undefined}>
      <div className="rb kcal">
        <b>{kcal(t.kcal)}</b>
        <small>KCAL</small>
        {label && <small style={{ fontWeight: 500, letterSpacing: 0, marginTop: 2 }}>{label}</small>}
      </div>
      <div className="rb p"><b>{f1(t.protein)}</b><small>PROTEİN</small></div>
      <div className="rb k"><b>{f1(t.karb)}</b><small>KARB</small></div>
      <div className="rb y"><b>{f1(t.yag)}</b><small>YAĞ</small></div>
    </div>
  );
}

export function KcalDot({ value }: { value: number }) {
  return (
    <span className="kc-dot">
      <b>{kcal(value)}</b>
      <small>KCAL</small>
    </span>
  );
}
