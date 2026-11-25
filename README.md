# foody

Kendi tarif defterim: tariflerim, fotoğraflarım, gramlarım ve kalorilerim.

**Adres:** https://yurugagarin.github.io/foody/

## Neler var

- **Galeri:** Bütün tarifler fotoğraflarıyla. Her birinde ortalama puan ve porsiyon başı kalori var.
- **Bugün ne yesem?** Sevdiğin ve uzun süredir yapmadığın yemekler daha sık önerilir.
- **Porsiyonum:** Bu sefer kaç gram koyduğunu girersin; kalori, protein, karbonhidrat ve yağ anında hesaplanır. Köfte, dilim gibi parçalara bölünen tariflerde kaç tane yediğini seçersin.
- **Malzeme kütüphanesi:** Her malzemenin 100 gramdaki değerleri bir kez girilir. Hangi tarifte kaç gram kullanırsan kullan, hesap buradan yapılır. Bir değeri düzeltirsen o malzemenin geçtiği bütün tarifler güncellenir.
- **Pişirme günlüğü:** Her pişirmede 1–10 puan, yöntem, derece, süre, not ve fotoğraf. Ortalama puan bunlardan çıkar. En iyi denemeyi işaretleyebilir, gramlarını varsayılan yapabilirsin.
- **Pişirme modu:** Adım adım, zamanlayıcılı; ekran kapanmaz.
- **Dolabımda ne var?** Elindeki malzemelere göre yapabileceğin tarifler ve eksikler.
- **Yapay zekâdan yapıştır:** Sohbetteki tarifi yapıştırırsın, malzemeler ve gramlar okunur. Kütüphanede olmayan malzemelerin değerleri bir kez onaylanır.
- **Yedekle / taşı:** Ayarlar'dan tek dosya indir, başka cihazda yükle.

Veriler (tarifler, fotoğraflar, notlar) tarayıcının içinde, **o cihazda** saklanır; repoya ya da bir sunucuya gitmez.

Telefonda: siteyi aç → iPhone'da Paylaş → “Ana Ekrana Ekle”, Android'de ⋮ → “Uygulamayı yükle”. Bilgisayarda aynı adres geniş ekran düzeniyle açılır.

## Tarif formatı

Yapay zekâya verilecek kalıp uygulamada var (Ayarlar → Yapay zekâ kalıbı). İlk dört tarif `src/seed-data.json` dosyasında; uygulama ilk açıldığında bunları yükler.

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:5173/foody/
npm test         # hesaplama ve içe aktarma testleri
npm run build    # dist/
npm run icons    # public/logo.svg değişince ikonları yeniden üretir
```

`main`'e her gönderimde GitHub Actions siteyi GitHub Pages'e yayınlar (Settings → Pages → Source: GitHub Actions).
