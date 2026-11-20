# Türkiye Haritası Geçiş Planı (Faz 0 envanteri)

Kaynak: `TURKIYE_GECIS_SARTNAMESI.md`. Bu belge PR 1 (Faz 0–2) sırasında gerçek koda bakılarak yazıldı.
Bu PR'da **hiçbir 3D dosyası silinmedi veya değiştirilmedi**; yeni harita ekranı 3D'ye paralel kurulacak.

## 1. Mevcut yapı envanteri

| # | Konu | Bulgu |
|---|---|---|
| 1 | Şehir ekranı girişi | `TycoonGameView.tsx` → `activeBottomTab === 'city'` iken `city3d/CityNeighborhoodView` çizilir (satır ~631). Alt menü sekmesi `GameBottomNavigation.tsx` (`id: 'city'`). |
| 2 | Bina seçimi / paneller | 3D'de dükkân bloğuna dokunma → `IsometricSelectionOverlay` kartı (satış, kâr, raf, "Rafları doldur", "Yönet"); ana binalar `BuildingDetailSheet` → `buildings/*Panel.tsx`. Dükkân yönetimi `EsnafAndTradePanel.tsx`, dükkân listesi `buildings/ShopDashboard.tsx` + `OyuncuOfisiPanel.tsx`. |
| 3 | Shop verisi | `models/trade.ts` `ShopInstance`; kayıt yeri `state.tradeState.shops`. Dükkânın 3D'ye bağı `cityBlockId` (blok kimliği, il değil). **Şehir alanı yoktu** → bu PR `cityId?` ekledi. |
| 4 | Açılış akışı / maliyet | `ShopOperations.openShop` (kurulum + dekor + kasa sermayesi, tek seferde tahsilat). Şablonlar `data/tradeCatalog.ts` `SHOP_TEMPLATES`. Şehir çarpanı yok. Açılış uyarısı `ShopOnboarding.getOpeningAdvice`. |
| 5 | Stok teslimatı / lojistik | `TradeProcurement` (sipariş, sevkiyat, `cargoAdjust`), `TradeInventory`. Mesafe kavramı yok; teslimat gün sayısı tedarikçi + kargo anlaşmasından gelir. |
| 6 | Save modeli | `SimulationEngine.CURRENT_SCHEMA_VERSION` **5 → 6** (bu PR). Anahtar `borsa_holding_simulator_save_v2` (localStorage). Migration `state/simulationStore.ts` `migrateIfNeeded` + `SimulationEngine.restoreFromSavedState` (+ `BalanceMigration`, `LoanAmortization`, onboarding/careerGoals göçleri). `...(st as SimulationState)` yayılımı sayesinde yeni alanlar kayıpsız taşınır. |
| 7 | Offline progress | `DayCloseProcessor.processOfflineProgress` → `advanceGameMinutes` → gün içi `stepShopsIntraday` (`ShopSales`) + gün sonu `TradeAndShopEngine.stepDailyTradeAndShops`. Üst sınır ~2 gerçek saat (`OFFLINE_MAX_REAL_MINUTES`). |
| 8 | 3D bağımlılıkları | `three` + `@types/three`. Kullanan dosyalar: `city3d/{ThreeCityScene,models,kit,assets}.ts` (toplam ~3.8 bin satır city3d). Modeller `public/models/` (5,6 MB: kaykit, kenney-commercial, kenney-suburban, `CREDITS.txt`). Dışarıdan tek giriş `TycoonGameView.tsx` → `CityNeighborhoodView`. |
| 9 | Haritaya taşınacak olaylar/uyarılar | Şehirdeki baloncuklar (`city-bubble-coin/box-*`: toplanabilir kasa, boş raf), sonraki olay kapsülü (`CityCameraControls`), hedef şeridi (`CityQuestStrip`), kilitli bina önizlemeleri, dünya olayları kartı. `cityLayout.ts` `withShopBubbles` mantığı marker uyarı halkasına uyarlanacak (Faz 10). |
| 10 | Silinebilecek (şimdi SİLİNMEDİ) | `city3d/*`, `public/models/**`, `three`/`@types/three` (başka kullanım yoksa), `city3d` testleri; eski izometrik `city/Isometric*` ve `buildings` PNG'leri klasik moda ait → ayrı karar. Shop kartlarının 2D bina görselleri (`public/buildings`) **kalmalı**. Faz 12'ye kadar dokunulmaz. |

Ek notlar: `package.json` içinde `asset-audit` ve `prestij-sure` komutları yok (şartnamedeki Faz 15 listesinde geçiyor); `city-audit` / `city-balance` PR 4'te eklenecek. Test: `node:test` + `tsx`, ~250 test.

## 2. Dosya bağımlılık listesi (şehir sistemi)

- `models/cities.ts` (tipler) ← `data/cityBalance.ts` ← `data/cityDefinitions.ts` ← `engine/CityMigration.ts`
- `engine/CityMigration.ts` ← `ShopOperations`, `SimulationEngine`, `DayCloseProcessor`, `state/simulationStore.ts`
- `components/game/HeadquartersSelectionModal.tsx` ← `App.tsx`
- Döngü yok: `CityMigration` yalnızca model ve veri dosyalarını içe aktarır.

## 3. Risk listesi

1. **Eski kayıt kaybı / donma** → seçim bekleyen kayıtta oyun durur; pencere kapatılamaz ama durum kayıtlıdır. Pencere yoksa oyun donardı: bu yüzden PR 1'e minimal pencere dahil edildi.
2. **Offline kazanç sömürüsü** → seçim beklerken geçen süre `lastRealTimestampISO` ileri alınarak kazanç sayılmıyor.
3. **Çift migration** → `cityMigration.status` + `prepareCityMigration` idempotent; testlerle doğrulandı.
4. **Yedek alınamaması** (localStorage kotası) → yedek hatası yüklemeyi engellemez, `QUOTA_ERROR` raporlanır. Yedek anahtarı `borsa_holding_simulator_save_pre_city_migration_backup`, ilk yedek ezilmez.
5. **Şema 6'ya geçiş** → eski kaydı olan oyuncu tarayıcıda v6'ya yükselir; eski sürüm kodu v6 kaydı okuyamaz (geri dönüş yedekten).
6. **Denge**: 12 şehrin çarpanları henüz simülasyonla ayarlanmadı (Faz 8). Şimdilik yalnızca "hiçbir şehir diğerini her ölçüde geçmesin" kuralı test ediliyor.
7. **Harita varlığı**: `mapPosition` enlem/boylamdan türetildi; Faz 3'te seçilen lisanslı SVG'ye göre kalibre edilecek (`cityBalance.ts` sabitleri). SVG/GeoJSON kaynağı ve lisansı Faz 3'te kaydedilecek.
8. **Yalnızca 12 şehirde yatırım** kararı henüz verilmedi: 81 il tanımlı ve hepsi seçilebilir; `profileKind: 'DEFAULT'` iller dengeli varsayılan profille çalışır. Ürün kararı PR 4'te netleşecek.
9. **Yeni dükkân şehri**: şimdilik merkez → başlangıç şehri → Ankara; gerçek şehir seçimi PR 3/4 (Faz 5, 7).

## 4. Save migration planı (uygulandı)

1. Şema 5 → 6. Yeni alanlar: `ShopInstance.cityId?`, `state.{playerStartCityId, selectedMapCityId, headquartersCityId, turkeyMapView, cityMigration}` (hepsi isteğe bağlı).
2. Yüklemede orijinal JSON bir kez yedeklenir (`SimulationStore.createPreCityMigrationBackup`).
3. `prepareCityMigration`: `cityId` eksik/bozuk dükkân varsa ve geçerli merkez yoksa `cityMigration.status = 'PENDING'`; dükkân yoksa doğrudan `COMPLETED`; merkez zaten geçerliyse sormadan onarım.
4. `PENDING` iken: `advanceGameMinutes`, `advanceRealSeconds`, `tickDay`, `closeCurrentDay`, `processOfflineProgress`, `openShop` etkisiz.
5. Oyuncu "Merkez şehrini seç" → `completeHeadquartersSelection`: şehri eksik tüm dükkânlar seçilen şehre atanır; `headquartersCityId` ve `playerStartCityId` yazılır; zaman damgaları şimdiye çekilir; durum `COMPLETED`.
6. Dokunulmayanlar: para/borç/kredi, kısıtlı bakiye, stok, çalışan, müdür, yükseltme, geçmiş, prestij, başarım, offline damgası (seçim anı hariç).

## 5. Fazlara göre dosya değişiklik planı

| PR / Faz | Yeni | Değişecek |
|---|---|---|
| PR 1 · Faz 0–2 (bu PR) | `models/cities.ts`, `data/cityBalance.ts`, `data/cityDefinitions.ts`, `engine/CityMigration.ts`, `HeadquartersSelectionModal.tsx`, testler | `models/trade.ts`, `models/simulation.ts`, `ShopOperations.ts`, `SimulationEngine.ts`, `DayCloseProcessor.ts`, `simulationStore.ts`, `App.tsx`, 3 şema testi |
| PR 2 · Faz 3–4 | `components/game/turkeyMap/*` (harita, marker, pan/zoom, bilgi paneli), yerel SVG + lisans notu | `TycoonGameView.tsx` (feature flag arkasında paralel sekme) |
| PR 3 · Faz 5–6 | Başlangıç şehri seçimi, Şehir Mağazaları ekranı, geri tuşu mantığı | `App.tsx`, `TycoonGameView.tsx`, `ShopOperations` (şehir parametresi) |
| PR 4 · Faz 7–9, 13 | `engine/CityExpansion.ts` (quote), `engine/CityEconomy.ts`, lojistik, `city-audit`, `city-balance` scriptleri | `ShopSales`, `TradeAndShopEngine`, `TradeProcurement`, `DayCloseProcessor`, `ShopOperations` |
| PR 5 · Faz 10–11 | Filtreler, uyarı halkaları, onboarding adımları | `GameBottomNavigation.tsx`, `FirstRunGuide.tsx`, `OnboardingRules.ts` |
| PR 6 · Faz 12 | — | `city3d/*`, `public/models/**`, `package.json` + lock (yalnızca doğrulandıktan sonra silinir) |
