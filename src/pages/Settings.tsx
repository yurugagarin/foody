import { useRef, useState } from 'react';
import { exportAll, importAll } from '../lib/backup';
import { AI_PROMPT } from '../lib/importer';
import { copyText, useToast } from '../lib/hooks';
import { LogoMark } from '../components/Logo';
import { Icon } from '../components/Icon';

export function Settings() {
  const file = useRef<HTMLInputElement>(null);
  const [toast, show] = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="page">
      <div className="row" style={{ gap: 14 }}>
        <LogoMark size={64} />
        <div className="stack" style={{ gap: 2 }}>
          <span className="sf it" style={{ fontSize: 40, lineHeight: 1 }}>foody</span>
          <span className="small muted">kendi tarif defterin</span>
        </div>
      </div>

      <section className="card stack">
        <h2 className="h2">Yedekle ve taşı</h2>
        <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Tariflerin, fotoğrafların ve notların bu cihazda saklanır. Telefonla bilgisayar arasında taşımak ya da yedeklemek için tek bir dosya indir, öbür cihazda “Yedekten yükle” de.
        </p>
        <div className="row wrap">
          <button className="btn gold" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              const blob = await exportAll();
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `foody-yedek-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 2000);
            } finally {
              setBusy(false);
            }
          }}><Icon name="download" size={16} />Yedek indir</button>
          <button className="btn" disabled={busy} onClick={() => file.current?.click()}><Icon name="upload" size={16} />Yedekten yükle</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (!confirm('Bu cihazdaki her şey yedektekiyle değiştirilecek. Devam edilsin mi?')) return;
            setBusy(true);
            try {
              const r = await importAll(f);
              show(`${r.recipes} tarif yüklendi.`);
            } catch (err) {
              show(err instanceof Error ? err.message : 'Yedek okunamadı.');
            } finally {
              setBusy(false);
            }
          }} />
        </div>
      </section>

      <section className="card stack">
        <h2 className="h2">Yapay zekâ kalıbı</h2>
        <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>Bir sohbette tarif aldığında bu kalıbı da gönder. Gelen cevabı “Yeni tarif → Yapay zekâdan yapıştır”a yapıştırınca gramlar ve 100 g değerleri kendiliğinden dolar.</p>
        <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={async () => show((await copyText(AI_PROMPT)) ? 'Kalıp kopyalandı.' : 'Kopyalanamadı.')}><Icon name="copy" size={16} />Kalıbı kopyala</button>
      </section>

      <section className="card stack">
        <h2 className="h2">Telefona uygulama gibi ekle</h2>
        <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>iPhone (Safari):</b> Paylaş düğmesi → “Ana Ekrana Ekle”.</li>
          <li><b>Android (Chrome):</b> ⋮ menüsü → “Uygulamayı yükle” ya da “Ana ekrana ekle”.</li>
          <li>Eklendikten sonra internet olmadan da açılır.</li>
        </ul>
      </section>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
