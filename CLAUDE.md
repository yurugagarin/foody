# foody — Claude için notlar

Kullanıcının kişisel tarif uygulaması (React + Vite + Dexie, GitHub Pages'te `/foody/`). Arayüz dili Türkçe. Tasarım: koyu "Sinema" teması, kalori ve makrolar renkli yuvarlak rozetlerde (`components/Badges.tsx`).

## Kullanıcı yeni tarif getirdiğinde

Kullanıcı tarifi Claude sohbetinde `AI_PROMPT` formatında (bkz. `src/lib/importer.ts`) JSON olarak hazırlatıp buraya yapıştırır.

1. Tarifi `src/seed-data.json` içindeki `tarifler` listesinin **sonuna** ekle ve benzersiz, değişmeyecek bir `"kod"` ver (ör. `"kakaolu-yulaf"`). Mevcut tariflerin `kod`'larını asla değiştirme.
2. Kontrol et: her malzemede gram ve `her_100g` var mı; toplam `kontrol_toplam` ile tutuyor mu (`npm test` dört tarif için bunu yapar; yenisi için hesaplayıp kullanıcıya söyle). `porsiyon` tarifin kaç porsiyonluk yapıldığıdır; uygulama "Kaç porsiyona böldün?" ile 1 porsiyonun gramını ve kalorisini verir. Köfte/dilim sayısıyla hesap yapılmaz (`birim` alanı kullanılmıyor).
3. Malzeme adlarını kütüphanedeki mevcut adlarla aynı yaz (ör. "Zeytinyağı", "Kakao", "Whey protein tozu"), yoksa aynı malzeme iki kez kaydolur.
4. `npm test && npm run build`, sonra commit ve `main`'e push (kullanıcı `main`'e doğrudan göndermeye izin verdi). Actions siteyi yayınlar.

Uygulama açılışta `syncSeed()` (`src/lib/seed.ts`) ile cihaza henüz gelmemiş tarifleri ekler; silinen tarif geri gelmez, kullanıcının düzenlemeleri ve malzeme değerleri ezilmez. Bu yüzden mevcut bir tarifi seed dosyasında değiştirmek cihazlardaki kopyayı **güncellemez**; kullanıcı onu uygulamadan düzenler.

## Diğer

- Gezinme: geri/kapat/kaydet tuşları `useGoBack()` (`src/lib/hooks.ts`) kullanır; alt ekrandan (düzenle, puanla, pişirme) dönüşte yeni sayfa açma (`nav(-1)` ya da `replace`). Gezinmeye dokunduysan `npm run build`, `npx vite preview --port 4173` ve `node scripts/geri-testi.cjs` çalıştır; hepsi OK olmalı.

- Gramlar her zaman çiğ/kuru; "kuru/çiğ" etiketi kullanma.
- Kullanıcı verisi (fotoğraflar, puanlar, gram düzenlemeleri) cihazda IndexedDB'de; repoda değil.
- Logo `public/logo.svg`; değişince `npm run icons`.
