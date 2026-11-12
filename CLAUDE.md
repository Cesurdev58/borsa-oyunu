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
- Proje Google AI Studio'da başlamıştı; sahibi AI Studio projesini sildi. Bundan sonra tüm geliştirme yalnızca bu depoda yapılır.

## Oyun dengesi (ölçülerek ayarlandı)

- **Ölçüm aracı:** `npm run balans` her dükkân türünün günlük cirosunu, kârını ve kurulum maliyetini kaç günde çıkardığını, ayrıca borsanın 5 farklı sayı üreteciyle 1 yıllık getirisini yazdırır. Dengeyi değiştirirsen önce/sonra çalıştır.
- **Ek not:** Kişisel dükkânda otomatik mal ikmali yoktur (yalnızca şirket şubelerinde vardır); oyuncu elle sipariş verir. Ölçümde bunu `src/tests/balance/restockBot.ts` yapar.
- **İlk dükkân kapısı:** Net değer `FIRST_SHOP_MIN_NET_WORTH` (`src/data/gameBalance.ts`, şu an 120.000 TL) olmadan ilk dükkân açılamaz. Amaç borsa aşamasının atlanmamasıdır. Yalnızca bu sayıyı değiştirerek başlangıcı kolaylaştırıp zorlaştırabilirsin.
- **Dükkân cirosu:** Müşteri başına sepet tutarı `avgBasketValueTL` (`src/data/tradeCatalog.ts`, her dükkân şablonunda). Eskiden her müşteri bir koli (~435 TL) alıyordu, büfe günde ~40.000 TL ciro yapıp kendini ~5 günde çıkarıyordu. Hedef geri dönüş süreleri: büfe 45, manav 60, kafe 80, giyim 100, elektronik 130, mobilya 130, market 120, galeri 180 gün (`scripts/balans-olcumu.ts`).
- **Haber dengesi:** Her sektörde olumlu ve olumsuz haber şablonlarının toplam etkisi (`baseImpact / decayRate`) eşit olmalı; aksi hâlde borsa tek yönlü yükselir. Yeni haber eklersen `src/tests/balance/balance.test.ts` dengeyi denetler.
- **Bilinen:** Borsa nominal olarak yılda ortalama +%65–85 (ekonomide enflasyon %28). Büfe/manav ROI'si hâlâ borsadan yüksek; bu bilinçli, ilk dükkân kapısı dengeyi sağlar.

## Oyun süresi ve arayüz tasarımı (mobil tycoon yönü)

- **Oyun günü varsayılan olarak 15 gerçek dakikadır** (`DEFAULT_REAL_MINUTES_PER_GAME_DAY`, `engine/GameClockEngine.ts`). Seçenekler 15/30/45/60 dk. Hız düğmeleri yalnızca 1x ve 2x'tir; 4x kaldırıldı (eski kayıttaki 4x otomatik 2x olur). Eski kayıtlar kendi gün uzunluğunu korur; yalnızca yeni oyun 15 dk ile başlar.
- **Arayüz ilkesi: basit, renkli, "tycoon" havası.** Teknik terim yok (limit emri, emir defteri, formül vb. "Gelişmiş" bölümüne taşınır). Alt menü emojili ve renkli, üst çubuk degrade, ekran arka planı açık degrade.
- **Borsa ekranı** (`buildings/BorsaPanel.tsx`): üstte nakit/hisse değeri kartı, seçili hisse için büyük AL / SAT kartı (− / + ile lot, 10/50/100/Hepsi), altta hisse kartları. Borsa kapalıyken AL/SAT piyasa emri olarak sıraya girer. Limit emri formu ve emir defteri `tycoon-advanced-toggle` düğmesinin arkasındadır; eski `data-testid`ler orada durur.
- **Dükkân ekranı** (`EsnafAndTradePanel.tsx`): dükkân yokken "İlk dükkânına ne kadar kaldı?" ilerleme çubuğu (`FIRST_SHOP_MIN_NET_WORTH`).
- **Şirket ekranı kilitliyken** (`SirketMerkeziPanel.tsx`) eşik `PROGRESSION_RULES.entrepreneurNetWorth`'tan okunur.
- **Rafları doldur** düğmesi (`shop-restock-all-btn`, dükkân ekranı): planı `engine/ShopRestockPlanner.ts` üretir (en ucuz toptancı, yoldaki siparişler sayılır, bütçeyi aşmaz). Test ölçüm robotu (`restockBot.ts`) aynı planı kullanır.
- **Çevrimdışı ilerleme** en fazla 8 oyun günüdür (`MAX_OFFLINE_GAME_DAYS`, 15 dk/gün ile ~2 gerçek saat).
- **Üst çubuk** (`GameTopBar.tsx`; para ≥₺100 değişince "+₺" yazısı süzülür, `float-up` animasyonu `index.css`): yalnızca gün/saat, büyük para kutusu, aşama yıldızı, zil, ayar. Net varlık, aşama ve borsa durumu para kutusuna dokununca açılan kartta.
- **Yazı boyutu:** en küçük yazı 13 punto (`index.css` içinde `--text-xs` ve `src/components/game` altında `text-[13px]`). Rakamlar daktilo (mono) yazısıyla çizilmez; `font-mono` yalnızca kod/teknik yerlerde kalır.
- **Dükkân ekranı** (`buildings/OyuncuOfisiPanel.tsx` + `buildings/ShopDashboard.tsx`): her dükkân için bir kart (satış, kâr, raf doluluğu, "Rafları doldur", "Yönet"). "Yönet" eski ayrıntılı paneli (`EsnafAndTradePanel`) açar; varlık/aşama/portföy/işlem geçmişi "Varlıklarım" düğmesinin arkasındadır (DOM'da gizli durur, testler okur).
- **Şirket sekmesi** (`TycoonGameView.tsx` + `buildings/SirketMerkeziPanel.tsx`): mor degrade başlık kartı, iki satırlı emojili alt sekmeler (Özet/Üretim/Ekip/Para/Gelişim; kimlikler `company-subtab-*` aynı). Fabrika ve Ar-Ge panelleri `company-factory-toggle` düğmesinin arkasındadır (DOM'da gizli durur).
- **İlk oyun rehberi** (`FirstRunGuide.tsx`): yalnızca 1. günde, bir kez gösterilen 4 adımlı açılış kartı; bitince `localStorage` anahtarı `first_run_guide_done_v1` işaretlenir (sunucu tarafında/testlerde hiç gösterilmez). **Kutlama** (`CelebrationOverlay.tsx`): dükkân sayısı ya da aşama artınca konfeti + kart (yalnızca görsel).
- Dükkân açılınca Dükkân ekranı otomatik dükkân kartlarına döner.
- **Şehirde dükkân kartı:** 3D şehirde dolu bir dükkân bloğuna dokununca panel açılmaz; `IsometricSelectionOverlay` içinde satış, kâr, raf doluluğu ve "Rafları doldur" (`selection-shop-restock-btn`) görünür, "Yönet" paneli açar (`ThreeNeighborhoodView.tsx`, `onRestockShop` → `TycoonGameView.handleRestockShop`). Testi `src/tests/city/shopSelectionCard.test.ts`. Not: bu kartın canlı tarayıcıda tıklayarak ekran görüntüsü doğrulaması yapılamadı (3D tuvalde isabetli tıklama zor); yalnızca test ve derleme doğrulandı.
- **Dükkân yönetim ekranı (Ticarium mantığı)** (`EsnafAndTradePanel.tsx`): üstte dükkân kartı üç büyük sayıyla (💰 Kasa, 📦 Raf, 🚚 Yolda); altında kasaya para koy / kâr al düğmeleri (5B/25B/100B), "Yoldaki siparişler" şeridi (kaç gün sonra gelir, "✅ geldi") ve ipucu. "🛒 Mal al" her ürün için kart gösterir (en ucuz toptancı otomatik, +10/+50/+100); tedarikçi/ödeme seçimi "Gelişmiş sipariş" düğmesinin arkasındadır (DOM'da gizli, `shop-advanced-order-toggle`). Tek dükkânda dükkân seçici çipleri ve "Kariyerin" kutusu gizlidir (testid'ler durur). Üretim, sözleşme ve depo "🏭 Toptan & Üretim" modundadır; her alt sekmenin başında 💡 açıklama vardır.
- **Açıklama balonu** (`ui/HelpTip.tsx`): küçük "?" düğmesi, dokununca tek cümlelik açıklama gösterir (kasa aktarma, yolda, kâr, memnuniyet).
- **Şehir üst şeridi** (`city/CityCameraControls.tsx`): sonraki olay kapsülü dar ekranda yalnızca emoji + süre gösterir (420 px ve üstünde yazı da gelir); yakınlaştırma etiketi de dar ekranda gizlenir. Üst çubukta para kutusu 360 px'te sığacak şekilde küçültüldü.
- **Bugünün görevleri** (`buildings/ShopDashboard.tsx`, `daily-tasks-card`): dükkân ekranının en üstünde, kayıt tutmadan dükkânların anlık durumundan türetilen iki görev (raflar yarıdan fazla dolu mu, bugün kâr var mı) ve "x/2" sayacı. Testi `src/tests/city/dailyTasks.test.ts`. Karar kartları, haftalık hedefler ve prestij henüz yok; eklenirse kayıt yapısı ve migration gerekir.
- **Banka / Ar-Ge / Haber panelleri** sade dile çevrildi: emojili başlıklar, 💡 kısa açıklama kutusu ve `HelpTip` balonları; haberde "🟢 Yükseltir / 🔴 Düşürür %x". Davranış ve `data-testid`ler değişmedi.
- Alt menü adları: Şehir, Borsa, Şirket, Haberler, Dükkân (kimlikler değişmedi: `bottom-nav-city/market/company/news/portfolio`).

## Klasörler

- `src/engine/` — oyun mantığı. `SimulationEngine.ts` ana döngü; `TradeAndShopEngine.ts` dükkân/ticaret ön yüzü ve günlük döngü; `MarketEngine.ts` borsa; `CentralLedgerEngine.ts` ve `AccountingEngine.ts` para hareketleri;
  `CompanyEngine.ts`, `IPOEngine.ts`, `BankLoanEngine.ts`, `MergerAcquisitionEngine.ts`.
- **Tek cüzdan kuralı:** Oyuncunun kişisel nakdi (`state.cash`) yalnızca `engine/WalletEngine.ts` içinden değişir
  (`earn` = para girer, `spend` = para çıkar, `setBalance` = defterle uzlaştırma). Başka dosyada `state.cash = ...` yazma;
  `src/tests/wallet/wallet.test.ts` bunu otomatik denetler ve ihlalde testi kırar. Şirket (ve NPC şirket) nakdi `x.financials.cash` de aynı şekilde yalnızca `engine/CompanyWallet.ts` içinden değişir (`earn`, `spend`, `assign`); test bunu da denetler.
  Dükkân kasaları (`cashAccountBalance`) henüz kendi motorlarında kalır.
- **Ticaret motoru parçalandı.** `TradeAndShopEngine.ts` artık ön yüzdür (eski adlarla çağırmaya devam edilir) ve günlük döngüyü (`stepDailyTradeAndShops`) tutar.
  Asıl işler: `TradeUniverse` (başlangıç durumu, kariyer aşaması), `TradeInventory` (stok partileri), `ShopOperations` (dükkân açma/yükseltme/kasa),
  `TradeProcurement` (tedarik, sipariş, sevkiyat), `TradeProduction` (üretim, araç, ticari sözleşme), `ShopIncorporation` (şirketleşme),
  `TradeAudit` (bütünlük denetimi), `ShopEquity` (dükkân özkaynağı). Katalog verileri `src/data/tradeCatalog.ts` içindedir (kaynaklar, reçeteler, tedarikçiler, dükkân şablonları).
- **Ana motor parçalandı.** `SimulationEngine.ts` artık ince bir ön yüzdür (durum, saat, kayıt). Ağır işler fonksiyon olarak ayrı dosyalarda ve ilk parametre `engine`:
  `DayCloseProcessor` (gün kapanışı, çevrimdışı ilerleme), `OrderBookProcessor` (emirler, hisse alım-satım), `StageProcessor` (mali yeniden hesaplama),
  `PlayerCompanyActions` (şirket kurma, sermaye, yatırım projesi, halka arz, devralma), `SimulationScenarios` (30 günlük simülasyon, stres testi),
  `SimulationPersistence` (kayıt temizleme/göç). Bu dosyalar `SimulationEngine`'i yalnızca tip olarak içe aktarır (`import type`), bu yüzden döngü oluşmaz.
- **Aşama kuralları tek yerde:** `engine/ProgressionRules.ts`. Girişimci/halka arz/holding eşikleri ve "hangi aşamadayım" hesabı yalnızca burada yazılır;
  başka dosyada `2_000_000` gibi eşik yazma, `PROGRESSION_RULES` sabitini kullan. Testleri `src/tests/progression/`.
- **Bağımlılık döngüsü yok** (89+ dosyada denetlendi). Yeni bir motor eklerken alt modüller ön yüzü (`TradeAndShopEngine`) içe aktarmasın; aşağıdan yukarıya doğru bağımlılık kur.
- `src/models/` — veri tipleri. Dükkân türleri `models/trade.ts` içinde `ShopType`
  (BUFE, MANAV, KAFE, GIYIM_MAGAZASI, ELEKTRONIK_MAGAZASI, MOBILYA_MAGAZASI, MARKET, OTOMOBIL_GALERISI).
- `src/state/simulationStore.ts` — kayıt/yükleme ve migration.
- `src/components/game/` — oyun arayüzü. `TycoonGameView.tsx` ana ekran, `BuildingDetailSheet.tsx` bina panelleri,
  `EsnafAndTradePanel.tsx` dükkân yönetimi.
  `BuildingDetailSheet.tsx` artık yalnızca alt sayfa kabuğu ve yönlendiricidir; her binanın paneli `components/game/buildings/` altında kendi dosyasındadır
  (`BorsaPanel`, `BankaPanel`, `HaberMerkeziPanel`, `OyuncuOfisiPanel`, `SirketMerkeziPanel`, `FabrikaPanel`, `ArgeMerkeziPanel`, `HoldingMerkeziPanel`).
  Her panel kendi form durumunu (useState) kendi içinde tutar; ortak tipler `buildings/buildingTypes.ts` içindedir.
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

**Zemin ve yollar** (`IsometricRoadLayer.tsx` ve `cityLayout.ts` içindeki `deriveCityAtmosphere`):
canlı çimen zemin (gün batımı ve gecede koyu yeşile döner), koyu asfalt yollar, açık kaldırımlar, bölgelere göre farklı zemin
(finans taş, ticaret otopark, sanayi beton, teknoloji ve Ar-Ge çim), harita kenarlarında ağaç kuşağı, ortada meydan ve gölet.
Ağaç kuşağı rastgele değil, sabit sayı üretecinden gelir; her çizimde aynıdır.

**Yol çizgilerinin yerini değiştirme.** Araçların ve yayaların rotaları `IsometricVehicleLayer.tsx` içinde sabit
koordinatlarla yazılı (halka yol 520..1070 × 380..770, güney cadde y=895, batı sokak x=215 gibi). Yolu oynatırsan araçlar yolun
dışından geçer; önce oradaki rotaları da güncelle. Bu yüzden yeni görünüm yol çizgilerini yerinde bıraktı, yalnızca görünümünü yeniledi.

`src/components/game/CityWorldView.tsx` ve `CityBuilding.tsx` **eski ve kullanılmıyor**; hiçbir yerden çağrılmaz.
Şehir görünümünü değiştirmek için bunları düzenleme.

## 3D şehir ekranı (oyunun şehir sekmesi artık bu)

Şehir sekmesi gerçek 3D (`three` kütüphanesi) gösterir; `TycoonGameView.tsx` artık `CityNeighborhoodView` çağırır.
Klasörü: `src/components/game/city3d/`

| Dosya | Görevi |
|---|---|
| `CityNeighborhoodView.tsx` | Sarmalayıcı: tarayıcı 3D çizemiyorsa ya da oyuncu "Klasik görünüme geç" dediyse eski izometrik görünümü gösterir. Seçim `localStorage` içinde `city_view_mode` anahtarında (`klasik` / `3d`). 3D kütüphanesi yalnızca bu sekme açılınca yüklenir. |
| `ThreeNeighborhoodView.tsx` | 3D ekranın React kısmı: tıklama, seçim paneli, yakınlaştırma düğmeleri, etiketler. Oyun verisini eski görünümle aynı fonksiyonlardan (`cityLayout.ts`) alır. |
| `ThreeCityScene.ts` | Sahne: kamera, ışık (sabah/gün/akşam/gece), yollar, araçlar, ağaçlar, tıklama ve üzerine gelme. |
| `models.ts` | Binaların 3D modelleri (8 ana bina, dükkân türleri, şehir blokları, kilitli/inşaat arsaları). |
| `kit.ts` | Ortak yapı taşları: malzeme, pencere dokuları, ağaç, araba, lamba. |
| `webgl.ts` | Tarayıcı 3D destekliyor mu kontrolü. Testler ve sunucu tarafı için hep "hayır" döner, yani testler eski görünümü kullanır. |

Kurallar ve notlar:
- 3D modeller kodla üretilir (düşük poligonlu). Eski "bina kodla çizilmez / PNG iste" kuralı yalnızca eski izometrik görünüm içindir;
  PNG bina görselleri (`public/buildings/`, `buildingSprites.ts`) ve zemin/yol notları da sadece eski görünümü etkiler.
- Harita koordinatları eski görünümle aynıdır (1600×1200 birim → 3D dünyada ×0,1). Yollar ve araç rotaları `ThreeCityScene.ts` içindeki
  `ROADWAYS`, `ZONES`, `ROUTES` sabitlerinde; yolu oynatırsan rotaları da güncelle.
- Dükkân türüne göre model: MARKET, KAFE, BUFE, MANAV, GIYIM_MAGAZASI, ELEKTRONIK_MAGAZASI, MOBILYA_MAGAZASI, OTOMOBIL_GALERISI hepsinin 3D modeli var.
  Boş dükkân arsası "DÜKKÂN AÇ" çimenlik arsa olarak görünür; boş `urban-ticaret-otel-5` Butik Otel olur.
- Etiketler kalabalık olmasın diye yakınlaşınca (kamera mesafesi < `LABEL_NEAR`) blok etiketleri görünür; ana binalar, dükkânlar, seçili ve üzerine gelinen her zaman gösterilir.
- Kilitli binalar çitli inşaat arsası + vinç olarak görünür.
- Gündüz/gece geçişinde ışık, gökyüzü ve çimen rengi yumuşakça değişir (`stepLook`); gece yıldızlar çıkar. Dönem değerleri `LOOKS` içinde.
- Hepsi açık hâli denemek için: `stageUnlocks`'u açık, şirketi kurulmuş bir kayıtla aç (Fabrika ve Ar-Ge şirket kurulunca, Holding 4. aşama ile açılır).
- Ekrandaki düğmelerin (sağ alt hız düğmeleri, üst bar, sol alt geçiş düğmesi) altına düşen etiketler otomatik gizlenir (`ThreeCityScene.ts`, `labelCovered`). Düğmelerin yeri değişirse oradaki sayıları güncelle.
- Ana binalara ayrıntılar `models.ts` içindeki `addCoreDetails` ile eklenir (giriş basamağı, çalı, bayrak, çatı klimaları, helikopter pisti, güneş paneli, yükleme rampası).
- Test sayfası `3d-deneme.html` ve `src/deneme3d/` silindi; yerine bu gerçek 3D şehir geldi.

## Bina görselleri (yalnızca eski izometrik görünüm için)

- Görseller `public/buildings/` altında şeffaf arka planlı PNG olarak durur ve `/buildings/ad.png` yolundan yüklenir.
- Bir bina `buildingSprites.ts` içinde tanımlıysa PNG ile, değilse eski CSS kutu çizimiyle gösterilir.
  PNG yüklenemezse eski çizime düşer.
- Yeni görsel eklemek: PNG'yi klasöre koy, `buildingSprites.ts` içine `src`, `widthPx` (harita birimi) ve
  `aspect` (PNG genişliği / yüksekliği) ile bir satır ekle.
- Görseller kodla çizilmez. Bina çizimi istenirse CSS/SVG ile bina üretme; sahibinden PNG iste.
- Stil: yarı gerçekçi, stilize izometrik 3D; ışık sol üstten; her bina kendi zemin parseliyle gelir.

Şu an PNG kullanan ana binalar: `BORSA`, `BANKA`.

**Dükkân görselleri türe göre seçilir** (`buildingSprites.ts` içinde `SHOP_TYPE_SPRITES` ve `getUrbanBlockSprite`):

| Dükkân türü | Görsel |
|---|---|
| `MARKET` | `market.png` |
| `KAFE` | `cafe.png` |
| `BUFE`, `MANAV`, `GIYIM_MAGAZASI`, `ELEKTRONIK_MAGAZASI`, `MOBILYA_MAGAZASI`, `OTOMOBIL_GALERISI` | Görseli yok; eski CSS kutu çizimi |

- Dükkânlar sırayla 3 bloğa yerleşir: `urban-ticaret-magaza-1`, `urban-ticaret-kafe-2`, `urban-ticaret-otel-5`.
  Hangi bloğun hangi görseli göstereceği artık bloğun adından değil, içindeki dükkânın türünden gelir.
- Blokta dükkân yoksa (boş arsa) bloğun eski varsayılanı görünür: 1. blok market, 2. blok kafe, 3. blok eski çizim.
- Yeni tür görseli eklemek: PNG'yi `public/buildings/` içine koy, `SHOP_TYPE_SPRITES` içine tür adıyla bir satır ekle.

## Bilinen eksikler

- 3D şehirde yayalar üç kaldırım rotasında yürür (`WALK_PATHS`); her rotadaki ilk 3 yaya arada Borsa, Banka ya da Haber Merkezi'nin kapısına girip çıkar (`WALK_DOORS`). Diğer binalara girmezler. Eski görünümdeki olay/nabız efektleri 3D'de yok.
- 3D modeller basit ve düşük poligonlu; ana binaların ayrıntısı artırılabilir ya da sahibinin vereceği hazır 3D model dosyalarıyla (.glb) değiştirilebilir.
- Yazı tipi ve simge dosyaları ağ kısıtı olan ortamlarda yüklenemeyebilir (oyunu etkilemez).
- Eski izometrik görünümde (klasik mod): Haber Merkezi, Merkez Bankası ve Holding tabanı yola yakın; 6 dükkân türü
  (büfe, manav, giyim, elektronik, mobilya, galeri) ve kalan ana binalar/şehir blokları PNG yerine eski kutu çizimiyle duruyor;
  bir dükkân görseli yüklenemezse o blok oturum boyunca eski çizimde kalır.

## Çalışma kuralları

- Ekonomi motorlarına dokunan her değişiklikten sonra `npm test` çalıştır.
- Görsel değişiklikten sonra projeyi derleyip gerçek ekran görüntüsüyle kontrol et; yalnızca derlenmesi yetmez.
- `data-testid` değerlerini testler kullanıyor; kaldırmadan önce `src/tests/` içinde ara.
- Kayıt yapısını değiştirirsen `simulationStore.ts` içindeki migration'ı da güncelle; eski kayıtlar bozulmamalı.
