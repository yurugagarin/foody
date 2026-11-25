// Checks that nothing typed is lost when the app is closed and opened again.
// Run: npm run build && npx vite preview --port 4173, then: node scripts/kalicilik-testi.cjs
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173/foody/';
let fails = 0;
const V = (sel) => sel + ' >> visible=true';
function check(ok, label, got) {
  if (!ok) fails++;
  console.log((ok ? 'OK   ' : 'FAIL ') + label + (got !== undefined ? ' -> ' + got : ''));
}
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  ctx.on('page', (pg) => pg.on('dialog', (d) => d.accept()));
  // "Open the app": a new page has an empty session, like a phone app that was closed.
  const open = async (hash) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => { fails++; console.log('PAGEERROR', e.message); });
    await p.goto(BASE + hash);
    await p.waitForTimeout(1200);
    return p;
  };
  let p = await open('');
  await p.click('a.tile >> text=Lokanta Usulü Yumuşak Köfte');
  await p.waitForTimeout(600);
  const recipe = new URL(p.url()).hash;
  await p.click(V('[aria-label="Kıyma (%10 yağlı) artır"]'));
  await p.click(V('[aria-label="Kıyma (%10 yağlı) artır"]'));
  await p.click(V('[aria-label="Porsiyon sayısını artır"]'));
  await p.fill(V('#pismis'), '700');
  await p.waitForTimeout(400);
  await p.close();

  p = await open(recipe);
  check((await p.inputValue(V('[aria-label="Kıyma (%10 yağlı) gram"]'))) === '520', 'kapatıp açınca kıyma gramı duruyor', await p.inputValue(V('[aria-label="Kıyma (%10 yağlı) gram"]')));
  check((await p.inputValue(V('#pismis'))) === '700', 'pişmiş ağırlık duruyor', await p.inputValue(V('#pismis')));
  check((await p.locator(V('text=/^5$/')).count()) > 0, 'porsiyon sayısı (5) duruyor');
  check((await p.locator(V('text=Girdiklerin telefona kaydedildi')).count()) > 0, '"kaydedildi" yazısı görünüyor');

  await p.click(V('text=Pişirdim, puanla'));
  await p.waitForTimeout(500);
  await p.fill(V('textarea'), 'Kıymayı 520 g yaptım');
  await p.click(V('button.chip >> text=Döküm tava'));
  await p.fill(V('input[inputmode="numeric"] >> nth=0'), '200');
  await p.waitForTimeout(400);
  await p.close();

  p = await open(recipe + '/puanla');
  check((await p.inputValue(V('textarea'))) === 'Kıymayı 520 g yaptım', 'puanlama notu duruyor');
  check((await p.locator(V('button.chip.on >> text=Döküm tava')).count()) === 1, 'seçilen yöntem duruyor');
  check((await p.inputValue(V('input[inputmode="numeric"] >> nth=0'))) === '200', 'derece duruyor');
  await p.click(V('text=Denemeyi kaydet'));
  await p.waitForTimeout(700);
  check((await p.inputValue(V('[aria-label="Kıyma (%10 yağlı) gram"]'))) === '520', 'kaydettikten sonra da bu seferki gram duruyor');
  check((await p.locator(V('text=Kıymayı 520 g yaptım')).count()) > 0, 'not denemeye yazıldı');
  await p.click(V('button:has-text("Her zamanki")'));
  await p.waitForTimeout(400);
  check((await p.inputValue(V('[aria-label="Kıyma (%10 yağlı) gram"]'))) === '500', '"Her zamanki" (onaylayınca) 500 g’a döner');
  await p.close();

  p = await open(recipe);
  await p.click(V('a:has-text("Düzenle") >> nth=0'));
  await p.waitForTimeout(500);
  const attemptUrl = new URL(p.url()).hash;
  check((await p.inputValue(V('textarea'))) === 'Kıymayı 520 g yaptım', 'deneme düzenlemede eski not dolu geliyor');
  await p.fill(V('textarea'), 'Limon suyu fazla geldi');
  await p.locator(V('#puan')).fill('4');
  await p.waitForTimeout(400);
  await p.close();
  p = await open(attemptUrl);
  check((await p.locator(V('text=Kaydetmediğin değişiklikler geri yüklendi')).count()) === 1, 'deneme düzenleme taslağı geri yüklendi');
  check((await p.inputValue(V('textarea'))) === 'Limon suyu fazla geldi', 'kaydedilmemiş yeni not duruyor');
  check((await p.inputValue(V('#puan'))) === '4', 'kaydedilmemiş yeni puan duruyor');
  await p.click(V('text=Değişiklikleri kaydet'));
  await p.waitForTimeout(700);
  check((await p.locator(V('text=Limon suyu fazla geldi')).count()) > 0, 'yeni not tarifte görünüyor');
  check((await p.locator(V('.attempt .sf >> text=/^4$/')).count()) > 0, 'yeni puan (4) tarifte görünüyor');
  await p.close();

  p = await open(recipe + '/duzenle');
  await p.fill(V('input[placeholder="Somonlu makarna"]'), 'Köfte (değişti)');
  await p.waitForTimeout(400);
  await p.close();
  p = await open(recipe + '/duzenle');
  check((await p.locator(V('text=Kaydetmediğin değişiklikler geri yüklendi')).count()) === 1, 'düzenleme taslağı geri yüklendi');
  check((await p.inputValue(V('input[placeholder="Somonlu makarna"]'))) === 'Köfte (değişti)', 'kaydedilmemiş ad duruyor');
  await p.click(V('text=Kayıtlı haline dön'));
  await p.waitForTimeout(500);
  check((await p.inputValue(V('input[placeholder="Somonlu makarna"]'))) === 'Lokanta Usulü Yumuşak Köfte', '"Kayıtlı haline dön" taslağı siler');
  await p.close();

  p = await open('#/yeni');
  await p.fill(V('textarea'), 'Kakaolu Yulaf\n- 60 g yulaf ezmesi');
  await p.waitForTimeout(400);
  await p.close();
  p = await open('#/yeni');
  check((await p.inputValue(V('textarea'))) === 'Kakaolu Yulaf\n- 60 g yulaf ezmesi', 'yapıştırılan metin duruyor');

  console.log(fails ? `\n${fails} HATA` : '\nHEPSİ TAMAM');
  process.exitCode = fails ? 1 : 0;
  await b.close();
})();
