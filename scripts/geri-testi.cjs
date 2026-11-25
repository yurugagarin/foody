const { chromium } = require('playwright');
// Checks every back / close / save button lands on the right screen.
// Run: npm run build && npx vite preview --port 4173, then: node scripts/geri-testi.cjs
const BASE = process.env.BASE || 'http://localhost:4173/foody/';
let fails = 0;
function hash(p) { return new URL(p.url()).hash || '#/'; }
async function expectHash(p, re, label) {
  await p.waitForTimeout(400);
  const h = hash(p);
  const ok = re.test(h);
  if (!ok) fails++;
  console.log((ok ? 'OK   ' : 'FAIL ') + label + ' -> ' + h);
}
const V = (sel) => sel + ' >> visible=true';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { fails++; console.log('PAGEERROR', e.message); });
  const D = /^#\/tarif\/[^/]+$/;
  const G = /^#\/$/;
  const openTile = async (name) => { await p.click(`a.tile >> text=${name}`); await expectHash(p, D, `galeri → ${name}`); };

  await p.goto(BASE); await p.waitForTimeout(1200);
  // A: edit + save, then back
  await openTile('Somonlu Makarna (Kremasız)');
  await p.click(V('[aria-label="Tarifi düzenle"]')); await expectHash(p, /duzenle$/, 'tarif → düzenle');
  await p.click(V('text=Değişiklikleri kaydet')); await expectHash(p, D, 'düzenle → kaydet → tarif');
  await p.click(V('[aria-label="Geri"]')); await expectHash(p, G, 'A: kaydettikten sonra geri → galeri');
  // B: edit + X
  await openTile('Somonlu Makarna (Kremasız)');
  await p.click(V('[aria-label="Tarifi düzenle"]'));
  await p.click(V('[aria-label="Vazgeç"]')); await expectHash(p, D, 'düzenle → X → tarif');
  await p.click(V('[aria-label="Geri"]')); await expectHash(p, G, 'B: geri → galeri');
  // C: rate + save
  await openTile('Kolay Yoğurt Cheesecake');
  await p.click(V('text=Pişirdim, puanla')); await expectHash(p, /puanla$/, 'tarif → puanla');
  await p.click(V('text=Denemeyi kaydet')); await expectHash(p, D, 'puanla → kaydet → tarif');
  await p.click(V('[aria-label="Geri"]')); await expectHash(p, G, 'C: geri → galeri');
  // D: rate + close, "Gramları değiştir"
  await openTile('Kolay Yoğurt Cheesecake');
  await p.click(V('text=Pişirdim, puanla'));
  await p.click(V('[aria-label="Kapat"]')); await expectHash(p, D, 'puanla → X → tarif');
  await p.click(V('text=Pişirdim, puanla'));
  await p.click(V('text=Gramları değiştir')); await expectHash(p, D, 'puanla → Gramları değiştir → tarif');
  await p.click(V('[aria-label="Geri"]')); await expectHash(p, G, 'D: geri → galeri');
  // E: cook mode close, cook to the end and rate
  await openTile('Kolay Yoğurt Cheesecake');
  await p.click(V('text=Pişirme modu')); await expectHash(p, /pisir$/, 'tarif → pişirme modu');
  await p.click(V('[aria-label="Pişirme modundan çık"]')); await expectHash(p, D, 'pişirme → X → tarif');
  await p.click(V('text=Pişirme modu'));
  for (let i = 0; i < 12; i++) { const nx = p.locator(V('text=Sonraki adım')); await p.waitForTimeout(250); if (await nx.count()) await nx.click(); else break; }
  await p.click(V('text=Bitti, puanla')); await expectHash(p, /puanla$/, 'pişirme → bitti → puanla');
  await p.click(V('text=Denemeyi kaydet')); await expectHash(p, D, 'puanla → kaydet → tarif');
  await p.click(V('[aria-label="Geri"]')); await expectHash(p, G, 'E: geri → galeri');
  // F: new recipe by hand, back, delete
  await p.click(V('[aria-label="Yeni tarif"]')); await expectHash(p, /yeni$/, 'alt menü + → yeni');
  await p.click(V('text=Elle yaz'));
  await p.fill(V('input[placeholder="Somonlu makarna"]'), 'Deneme Tarifi');
  await p.fill(V('input[aria-label="Malzeme"]'), 'Makarna');
  await p.fill(V('input[aria-label="Gram"]'), '100');
  await p.click(V('text=Tarifi kaydet')); await expectHash(p, D, 'yeni → kaydet → tarif');
  await p.click(V('[aria-label="Geri"]')); await expectHash(p, G, 'F: yeni tarif sonrası geri → galeri');
  await openTile('Deneme Tarifi');
  p.once('dialog', (d) => d.accept());
  await p.click(V('button:has-text("Sil")')); await expectHash(p, G, 'tarifi sil → galeri');
  // G: Dolabım → recipe → back
  await p.click(V('.bottomnav >> text=Dolabım')); await expectHash(p, /dolap$/, 'alt menü → dolabım');
  await p.click(V('a.card >> nth=0')); await expectHash(p, D, 'dolabım → tarif');
  await p.click(V('[aria-label="Geri"]')); await expectHash(p, /dolap$/, 'G: geri → dolabım');
  await p.click(V('[aria-label="Geri"]')); await expectHash(p, G, 'dolabım geri → galeri');
  // H: Malzemeler → recipe link → back
  await p.click(V('.bottomnav >> text=Malzemeler'));
  await p.click(V('.list-btn >> text=Somon'));
  await p.click(V('a >> text=Somonlu Makarna (Kremasız)')); await expectHash(p, D, 'malzemeler → tarif');
  await p.click(V('[aria-label="Geri"]')); await expectHash(p, /malzemeler$/, 'H: geri → malzemeler');
  // I: phone/browser back after editing
  await p.click(V('.bottomnav >> text=Galeri'));
  await openTile('Protein Brownie (Islak Kek)');
  await p.click(V('[aria-label="Tarifi düzenle"]'));
  await p.click(V('text=Değişiklikleri kaydet')); await expectHash(p, D, 'düzenle → kaydet');
  await p.goBack(); await expectHash(p, G, 'I: telefonun geri tuşu → galeri');
  // J: recipe opened directly from a link
  const url = BASE + '#/tarif/' + (await p.evaluate(async () => {
    const r = await new Promise((res) => { const q = indexedDB.open('foody'); q.onsuccess = () => { const t = q.result.transaction('recipes').objectStore('recipes').getAll(); t.onsuccess = () => res(t.result[0].id); }; });
    return r;
  }));
  const p2 = await ctx.newPage(); await p2.goto(url); await p2.waitForTimeout(1000);
  await p2.click(V('[aria-label="Geri"]')); await expectHash(p2, G, 'J: linkten açılan tarif → geri → galeri');
  await p2.goto(url + '/duzenle'); await p2.waitForTimeout(800);
  await p2.click(V('[aria-label="Vazgeç"]')); await expectHash(p2, D, 'linkten açılan düzenle → X → tarif');
  console.log(fails ? `\n${fails} HATA` : '\nHEPSİ TAMAM');
  process.exitCode = fails ? 1 : 0;
  await b.close();
})();
