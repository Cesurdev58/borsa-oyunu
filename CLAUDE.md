# Borsa & Holding Simülatörü — proje notları

Bu dosya, projede çalışan yapay zekâ oturumlarının her seferinde baştan keşfetmemesi için tutulur.
Yapıyı değiştiren her işten sonra güncelle.

## Oyunun hedefi

Tek kariyer üzerinde birbirine dönüşen üç simülasyon:

Borsa yatırımcısı → ilk dükkân (esnaf) → şubeler → şirketleşme → üretim/holding → halka arz.

Aşamalar ayrı mod değildir; kişisel nakit, portföy, dükkânlar ve şirket kasası tek ekonomide çalışır.
Oyuncu 100.000 TL kişisel nakitle, yalnızca borsa erişimiyle başlar.

Sahibi kod yazmıyor; açıklamalar ve raporlar Türkçe ve teknik terimsiz olmalı.

## Teknik yapı

- Vite + React 19 + TypeScript + Tailwind 4. Sunucu yok; kayıt tarayıcı `localStorage` üzerinde.
- Kurulum: `npm install --legacy-peer-deps` (düz `npm install` bağımlılık çakışmasıyla hata verir).
- Tip denetimi: `npm run lint` · Testler: `npm test` · Derleme: `npm run build`
- Proje Google AI Studio'da başladı. Aynı dosyayı hem AI Studio'da hem burada düzenleme; değişiklikler birbirini ezer.

## Klasörler

- `src/engine/` — oyun mantığı. `SimulationEngine.ts` ana döngü; `TradeAndShopEngine.ts` dükkân, sipariş,
  stok, sevkiyat; `MarketEngine.ts` borsa; `CentralLedgerEngine.ts` ve `AccountingEngine.ts` para hareketleri;
  `CompanyEngine.ts`, `IPOEngine.ts`, `BankLoanEngine.ts`, `MergerAcquisitionEngine.ts`.
- `src/models/` — veri tipleri. Dükkân türleri `models/trade.ts` içinde `ShopType`
  (BUFE, MANAV, KAFE, GIYIM_MAGAZASI, ELEKTRONIK_MAGAZASI, MOBILYA_MAGAZASI, MARKET, OTOMOBIL_GALERISI).
- `src/state/simulationStore.ts` — kayıt/yükleme ve migration.
- `src/components/game/` — oyun arayüzü. `TycoonGameView.tsx` ana ekran, `BuildingDetailSheet.tsx` bina panelleri,
  `EsnafAndTradePanel.tsx` dükkân yönetimi.
- `src/tests/` — `node:test` ile yazılmış testler.

## Şehir haritası (en çok karıştırılan kısım)

Harita 1600×1200 sanal birimlik bir sahnedir ve `src/components/game/city/` altında çizilir.

| Dosya | Görevi |
|---|---|
| `IsometricNeighborhoodView.tsx` | Şehir ekranının kökü; seçim ve kamera durumu |
| `IsometricMap.tsx` | Sahneyi ve katmanları dizer |
| `IsometricBuilding.tsx` | **8 ana binayı** çizer |
| `IsometricDecorationLayer.tsx` | **22 şehir bloğunu** ve ağaç, lamba gibi dekorları çizer |
| `IsometricRoadLayer.tsx` | Yollar, parseller, meydan |
| `cityLayout.ts` | Bütün koordinatlar ve bina durumlarının oyun verisinden türetilmesi |
| `buildingSprites.ts` | Bina kimliği → PNG görseli eşleştirmesi |

İki ayrı bina türü vardır:

- **Ana binalar** (`CityBuildingId`): `BORSA`, `BANKA`, `HABER_MERKEZI`, `OYUNCU_OFISI`, `SIRKET_MERKEZI`,
  `FABRIKA`, `ARGE_MERKEZI`, `HOLDING_MERKEZI`. Konumları `cityLayout.ts` başındaki tabloda.
- **Şehir blokları**: `cityLayout.ts` içindeki `STATIC_CITY_URBAN_BLOCKS`, kimlikleri `urban-...` ile başlar
  (ör. `urban-ticaret-magaza-1`, `urban-ticaret-kafe-2`, `urban-ticaret-toptanci-4`).
  Tıklanınca bir ana binanın panelini açarlar (`linkedBuildingId`).

`src/components/game/CityWorldView.tsx` ve `CityBuilding.tsx` **eski ve kullanılmıyor**; hiçbir yerden çağrılmaz.
Şehir görünümünü değiştirmek için bunları düzenleme.

## Bina görselleri

- Görseller `public/buildings/` altında şeffaf arka planlı PNG olarak durur ve `/buildings/ad.png` yolundan yüklenir.
- Bir bina `buildingSprites.ts` içinde tanımlıysa PNG ile, değilse eski CSS kutu çizimiyle gösterilir.
  PNG yüklenemezse eski çizime düşer.
- Yeni görsel eklemek: PNG'yi klasöre koy, `buildingSprites.ts` içine `src`, `widthPx` (harita birimi) ve
  `aspect` (PNG genişliği / yüksekliği) ile bir satır ekle.
- Görseller kodla çizilmez. Bina çizimi istenirse CSS/SVG ile bina üretme; sahibinden PNG iste.
- Stil: yarı gerçekçi, stilize izometrik 3D; ışık sol üstten; her bina kendi zemin parseliyle gelir.

Şu an PNG kullanan binalar: `BORSA`, `BANKA`, `urban-ticaret-magaza-1` (market), `urban-ticaret-kafe-2` (kafe).

## Bilinen eksikler

- Dükkân blokları türe değil sıraya bağlı: `cityLayout.ts` içinde `urban-ticaret-magaza-1` her zaman `shops[0]`,
  `urban-ticaret-kafe-2` her zaman `shops[1]`. İlk dükkân manav olsa bile market görseli görünür.
  Görsel, dükkânın `shopType` değerine göre seçilmeli.
- Parseller eski küçük kutu binalara göre ölçülü; PNG binalar komşularına çok yakın duruyor.
- Koyu şehir zemini yeni bina stiliyle uyumsuz.
- Kalan 6 ana bina ve 20 şehir bloğu hâlâ CSS kutu çizimi kullanıyor.

## Çalışma kuralları

- Ekonomi motorlarına dokunan her değişiklikten sonra `npm test` çalıştır.
- Görsel değişiklikten sonra projeyi derleyip gerçek ekran görüntüsüyle kontrol et; yalnızca derlenmesi yetmez.
- `data-testid` değerlerini testler kullanıyor; kaldırmadan önce `src/tests/` içinde ara.
- Kayıt yapısını değiştirirsen `simulationStore.ts` içindeki migration'ı da güncelle; eski kayıtlar bozulmamalı.
