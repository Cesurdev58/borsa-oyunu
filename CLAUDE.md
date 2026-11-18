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
- **İlk dükkân kapısı** (`engine/FirstShopGate.ts`): "borsayı tanı" görevleri: bir hisse al, başka bir sektörden de al, bir hisseni sat. Üçü bitince ilk dükkân açılır (normalde ilk 3–5 gerçek dakika). Eskiden kapı net değer 120.000 TL idi ve ilk dükkânı 32–44 gerçek saat bekletiyordu (ölçüldü). `FIRST_SHOP_MIN_NET_WORTH` (`src/data/gameBalance.ts`) artık yalnızca "zaten zengin" kısayoludur (çok parayla başlayan oyun ve testler görev yapmadan geçer). Arayüz kartı `ui/FirstShopGateCard.tsx` (`first-shop-progress`, `first-shop-gate-step-*`).
- **Dükkân cirosu:** Müşteri başına sepet tutarı `avgBasketValueTL` (`src/data/tradeCatalog.ts`, her dükkân şablonunda). Eskiden her müşteri bir koli (~435 TL) alıyordu, büfe günde ~40.000 TL ciro yapıp kendini ~5 günde çıkarıyordu. Hedef geri dönüş süreleri: büfe 45, manav 60, kafe 80, giyim 100, elektronik 130, mobilya 130, market 120, galeri 180 gün (`scripts/balans-olcumu.ts`).
- **Haber dengesi:** Her sektörde olumlu ve olumsuz haber şablonlarının toplam etkisi (`baseImpact / decayRate`) eşit olmalı; aksi hâlde borsa tek yönlü yükselir. Yeni haber eklersen `src/tests/balance/balance.test.ts` dengeyi denetler.
- **Haber belirsizliği** (`NewsEngine.generateDailyNews`): haberlerin %25'i "piyasa zaten bekliyordu" (`reaction: 'PRICED_IN'`, etki ×0,2), %12'si "ters tepki" (`'REVERSAL'`, etki ×−0,5); `expectedImpact` ilk okunuştaki beklentidir. Haberler ekranı ilk gün "Beklenti: …", ertesi gün gerçek etkiyi ve tepki notunu (`news-reaction-*`) gösterir. Ölçüm (5 tohum × 400 gün): eskiden haber sektörü 3 günde ±%2,1–2,4 ayrıştırıyor ve %74–81 yönü tutuyordu (garanti para makinesi); şimdi ±%1,45 ve %69.
- **Küçük yükseltmeler** (`data/shopUpgrades.ts`, motor `engine/ShopUpgrades.ts`): her kişisel dükkânda seviye yükseltmesine ek 6 yükseltme (tabela, vitrin, ikinci kasa, reklam, sadakat kartı, iç mekân); etkileri "+%x müşteri" / "+%x sepet", `ShopSales.computeShopDailyDemand` çarpar. 3. ve 4. yükseltme dükkân 2. seviye, 5. ve 6. yükseltme 3. seviye ister. Fiyat = kurulum maliyeti × `costShare` × türün katsayısı (`SHOP_UPGRADE_COST_MULTIPLIER`); katsayılar 6 yükseltmenin hepsinin dükkânın hedef geri dönüş süresinin ~%80'inde kendini çıkaracağı şekilde ölçüldü (`npm run balans` → "YÜKSELTMELER"). Kayıtta `ShopInstance.upgrades` (eski kayıtta yok = yükseltme yok). Arayüz: Yönet → Geliştir, `shop-small-upgrades`, `shop-small-upgrade-buy-*`. Testi `src/tests/balance/shopUpgrades.test.ts`.
- **Portföy yöneticisi** (borsa otomasyonu, `engine/AutoInvestEngine.ts`, ayarlar `AUTO_INVEST_*` `gameBalance.ts`): bir kez 50 bin ₺ ücretle tutulur; açıkken gün kapanışında (adım 5B-2b, müdürlerden sonra) kenarda kalacak paranın (`reserve`, 50B/100B/250B/1Mn) üstündeki kişisel nakit borsadaki bütün şirketlere eşit dağıtılır (oyuncunun şirketi ve devraldıkları hariç; %30 sahiplik sınırı aşılmaz; normal komisyon). Kayıtta `state.autoInvest`. Arayüz Borsa ekranında `auto-invest-card`, `auto-invest-hire-btn`, `auto-invest-toggle`, `auto-invest-reserve-*`. **Bilinçli olarak eklenmedi:** hisselerin "gerçek değerini" (ucuz/pahalı) gösteren analist: ölçümde bu bilgiyle 10 günde bir en ucuz 5 hisseye geçen robot eşit sepetin ~2 katı getiri aldı (garanti kazanç). Testi `src/tests/market/autoInvest.test.ts`.
- **Gösteriş harcamaları** (`data/lifestyle.ts`, motor `engine/LifestyleEngine.ts`, pencere `LifestyleModal.tsx`): daire 150 bin → özel ada 300 Mn; her biri bir kez alınır, kişisel nakitten ödenir, **net varlığa sayılmaz** ve ticari itibar verir (`tradeState.tradeReputationScore`, en çok 100; oyuncu 58 ile başlar). İtibar dükkân müşterisini artırır (`ShopSales` itibar çarpanı) ve şirketleşme şartıdır (≥60). Kayıtta `state.lifestyle` (eski kayıtta yok). Açılış: üst çubuk para kartı `tycoon-top-lifestyle`; hedef zincirindeki `goal-first-luxury` hedefinin "Git" düğmesi de açar (hedef türü `LUKS`). Testi `src/tests/ui/lifestyle.test.ts`.
- **Müdür dengesi:** `npm run balans` "MÜDÜR" bölümü her dükkân türünü 2. seviyede elle (her gün rafları doldurarak) ve müdürle 90 gün oynatır. Hedef: müdürlü kâr, elle kârın %70–85'i (şu an %71–86). Ayar sayıları `gameBalance.ts` içinde `MANAGER_*`.
- **Bilinen:** Borsa nominal olarak yılda ortalama +%70–92 (ekonomide enflasyon %28; perakende düzeltmesinden önce +%65–85'ti). Büfe/manav ROI'si hâlâ borsadan yüksek; bu bilinçli, ilk dükkân kapısı dengeyi sağlar.
- **Ölçümde karar kartları:** `npm run balans` dükkân ve müdür bölümlerinde kartlara "dikkatli oyuncu" gibi cevap verir (`src/tests/balance/decisionBot.ts`). Kartları hiç cevaplamayan oyuncu (kart süresi dolunca B seçeneği uygulanır) dükkân türüne göre ~%10–40 daha az kâr eder.

## Geç oyun dengesi (şirket ve holding)

Eskiden şirket satışı yalnızca kendi kapasitesine bağlıydı; fabrika büyüdükçe sınırsız satıyor, ~90 günde ikiye katlanıyordu (900. günde günde 12,9 Mn kâr). Ayarların hepsi `src/data/gameBalance.ts` içinde "GEÇ OYUN DENGESİ" başlığı altında.

- **Sektör pazarı** (`engine/SectorMarket.ts`): her sektörün günlük pazarı sınırlıdır (`baseSectorMarketUnits`, rakiplerin kapasitesinden türetilir, `RIVAL_START_SHARE` = rakipler başta %45). Oyuncu yalnızca rakiplerin bıraktığı boşluğa satar; talep boşluğa yaklaşınca yumuşakça tavana dayanır (`saturatedPlayerDemand`, `CompanyDailyStep` içinde). Oyuncu büyüdükçe rakiplerin müşterisi azalır (`RIVAL_PRESSURE`, `rivalDemandMultiplier`, NPC adımında `AccountingEngine.stepCompanyFinancialsOneDay` son parametresi). Bağlam her gün kapanışında ve gün içi adımda `refreshPlayerMarketContext` ile şirkete yazılır (`operations.sectorMarketUnits`, `rivalUnitsInMarket`, `controlledRivalUnits`, `playerMarketSharePct`, `marketSaturated`).
- **Rakipler gerçek büyüklükte:** NPC şirketlerin hisse sayısı, kapasitesi, personeli ve bilançosu `NPC_SCALE` (50) katı. Hisse fiyatı ve tahta derinliği (`liquidityDepthLots`) değişmez, bu yüzden borsa aşaması aynı kalır (ölçüldü, fark %1'in altında). Holding açılışı (%5 pay) artık ~6 Mn TL ister.
- **Devralma:** aynı sektördeki rakip devralınınca artık oyuncuyla yarışmaz, müşterileri oyuncuya açılır; kâr payı = rakibin günlük net kârı × sahiplik × `HOLDING_PAYOUT_RATIO`. Borsadan normal alımla bir rakibin en fazla `MARKET_BUY_MAX_OWNERSHIP_PCT` (%30) alınabilir (`MarketEngine.maxMarketBuyableShares`); kontrol için devralma teklifi (kontrol primi) gerekir. Holding ekranı tahmini bedeli ve günlük ek kazancı gösterir (`MergerAcquisitionEngine.estimateTakeover`).
- **Yatırım daha yavaş:** kapasite yatırımı birim maliyeti `CAPEX_UNIT_MULTIPLIER` (9, eskiden 4). Tam satılan kapasitede geri dönüş ~120–185 gün.
- **Vergiler** (`engine/TaxRules.ts`): şirket kârına kademeli kurumlar vergisi (`CORPORATE_TAX_BRACKETS`, günlük 150 bin üstü +%7, 600 bin üstü +%15). Servet vergisi (`engine/WealthTaxEngine.ts`, gün kapanışı 5B-3): 30 günde bir, nakit + hisse + holding kasası + şirkete verilen ortak borcu + kişisel dükkân kasaları − borç toplamının 20 Mn üstünden yılda %3; nakit yetmezse kısa vadeli borca yazılır. Üst çubuktaki para kartında açıklama çıkar (`tycoon-wealth-tax-note`).
- **Kapatılan açıklar:** şirketten "yönetici maaşı/huzur hakkı" günde en fazla max(25 bin, cironun %3'ü) çekilebilir (eskiden sınırsızdı, %15 vergiyle bütün kasa çekiliyordu); sermaye azaltımı en fazla konulan sermaye kadar; stok tasfiyesi üretim maliyetinin altında (pazar dolunca fazla üretimi tasfiyeyle satmak kâr kapısıydı); şirketi olmayan oyuncunun bireysel kredisine +%20 faiz (borsa getirisiyle ucuz kredi arbitrajı); aynı türden her ek dükkân müşteriyi paylaşır (`SHOP_SAME_TYPE_CROWDING`); cevapsız karar kartının süresi dolunca B seçeneği uygulanır (hızlı ilerletmek kötü olaydan kaçış olmasın).
- **Ölçüm:** `npm run balans` → "ŞİRKET" bölümü, robot `src/tests/balance/companyBot.ts` (`growCompanyGreedy` pazar dolana kadar en büyük yatırımı yapar; `expandByTakeover` temettü çekip aynı sektördeki rakibi devralır). Şu anki sonuç: teknolojide pazar ~900. günde dolar, kâr günde ~0,9 Mn'da düzleşir; iki rakip devralınınca ~1,4 Mn. Savunmada ~2,7 Mn, enerjide ~0,6 Mn. Testleri `src/tests/balance/lateGame.test.ts`.
- **Eski kayıt göçü** (`engine/BalanceMigration.ts`, `state.balanceVersion` = 2, `restoreFromSavedState` içinde bir kez): rakipler büyütülür, oyuncunun elindeki hisse adedi ve değeri aynı kalır (yalnızca yüzde küçülür); eskiden çok ucuza devralınmış rakiplerin bedeli iade edilip kontrol bırakılır; eski dengede dev olmuş şirketin personeli ve üretim planı yeni pazara göre indirilir. Oyuncuya "Oyun dengesi güncellendi" bildirimi çıkar (`engine.consumeMigrationNotices`, `App.tsx`).
- **Perakende düzeltmesi:** perakendede birim maliyet 108 → 95, işçi maaşı 1450 → 1000 (`data/sectors.ts`). Eskiden marj işçiliği karşılamıyordu: oyuncu şirketi hiç kâra geçmiyor, rakip perakende hisseleri her yıl ~%50 eriyordu (borsanın garantili "en kötü hissesi"). Şimdi perakende yavaş ama kârlı.
- **Sektör seçimi** (şirket kurma ekranı, `SirketMerkeziPanel.tsx`, veri `data/sectorGuide.ts`): 8 sektör kartı (`company-sector-choice-*`, Kolay/Orta/Zor), seçilen sektörün tanıtımı (`company-sector-detail`): büyüme hızı, kâr tavanı, rakip almak kolaylığı (3 nokta) + "Artısı" / "Dikkat". Puanlar robotla 3000 gün ölçülerek verildi (dosyanın başında sonuçlar var); denge değişirse yeniden ölç. Şu an Savunma/Biyoteknoloji/Teknoloji hızlı ve kolay ama rakipleri pahalı; Finans/Perakende/Lojistik yavaş ama rakipleri ucuz. Sektörler eşit güçte değil, bilinçli olarak zorluk seçimi gibi.

## Oyun süresi ve arayüz tasarımı (mobil tycoon yönü)

- **Oyun günü varsayılan olarak 15 gerçek dakikadır** (`DEFAULT_REAL_MINUTES_PER_GAME_DAY`, `engine/GameClockEngine.ts`). Seçenekler 15/30/45/60 dk. **Ama hızlı başlangıç** (`engine/TempoRules.ts`, ayarlar `TEMPO_*` `gameBalance.ts`): şirket kurulana kadar bir gün en fazla 2 dk, halka arza kadar 5 dk; sonra seçilen uzunluk. Ayarlarda `settings-fast-start-toggle` kapatır (`state.fastStartTempo`, eski kayıtta yoksa açık). Saat hesabı her yerde `effectiveRealMinutesPerGameDay(state)` kullanır; `realMinutesPerGameDay` yalnızca oyuncunun seçimidir. Saat testleri `setFastStartTempo(false)` ile 15 dk ölçer. Hız düğmeleri yalnızca 1x ve 2x'tir; 4x kaldırıldı (eski kayıttaki 4x otomatik 2x olur). Eski kayıtlar kendi gün uzunluğunu korur; yalnızca yeni oyun 15 dk ile başlar.
- **Arayüz ilkesi: sade, profesyonel mobil tycoon.** Teknik terim yok (limit emri, emir defteri, formül vb. "Gelişmiş" bölümüne taşınır). Görsel kurallar aşağıdaki "Tasarım sistemi" bölümündedir.
- **Borsa ekranı** (`buildings/BorsaPanel.tsx` + `buildings/InvestorSections.tsx`): üstte nakit/hisse değeri kartı; altında üç kutuluk şerit (`borsa-tools-strip`): **Varlıklarım** (`assets-toggle` → `borsa-assets-section`: toplam varlık, hisselerim kâr/zarar, kariyer aşamaları), **İşlemlerim** (`borsa-history-toggle` → `borsa-history-section`, Hepsi/Alış-satış/Diğer süzgeci), **Hedef emir** (`tycoon-advanced-toggle` → `borsa-orders-section`: limit emri "hedef fiyat" diliyle, −%5…+%5 kısayolları, bekleyen/sonuçlanan emirler). Bölümler DOM'da gizli durur (testler okur). Seçili hisse için AL/SAT kartı: − / + ile lot, tek sırada 5 eş kutu (10/50/100/Hepsini al/Hepsini sat, `tycoon-lot-preset-*`, `tycoon-lot-max-buy-btn`, `tycoon-lot-max-sell-btn`; kutular yalnızca lotu doldurur), altında iki eşit AL/SAT düğmesi. Borsa kapalıyken AL/SAT piyasa emri olarak sıraya girer. Varlıklar ve işlem geçmişi eskiden Dükkân ekranındaydı; oradan kaldırıldı.
- **Dükkân ekranı** (`EsnafAndTradePanel.tsx`): dükkân yokken "İlk dükkânına ne kadar kaldı?" ilerleme çubuğu (`FIRST_SHOP_MIN_NET_WORTH`).
- **Şirket ekranı kilitliyken** (`SirketMerkeziPanel.tsx`) eşik `PROGRESSION_RULES.entrepreneurNetWorth`'tan okunur.
- **Rafları doldur** düğmesi (`shop-restock-all-btn`, dükkân ekranı): planı `engine/ShopRestockPlanner.ts` üretir (en ucuz toptancı, yoldaki siparişler sayılır, bütçeyi aşmaz). Test ölçüm robotu (`restockBot.ts`) aynı planı kullanır.
- **Çevrimdışı ilerleme** gerçek süreyle sınırlıdır: ~2 gerçek saat (`OFFLINE_MAX_REAL_MINUTES`); gün sayısı `maxOfflineGameDays` ile gün uzunluğundan hesaplanır (15 dk/gün → 8 gün, 2 dk/gün → 60 gün).
- **Üst çubuk** (`GameTopBar.tsx`; para ≥₺100 değişince "+₺" yazısı süzülür, `float-up` animasyonu `index.css`): yalnızca gün/saat, büyük para kutusu, aşama yıldızı, zil, ayar. Net varlık, aşama ve borsa durumu para kutusuna dokununca açılan kartta.
- **Yazı boyutu:** en küçük yazı 13 punto (`index.css` içinde `--text-xs` ve `src/components/game` altında `text-[13px]`). Rakamlar daktilo (mono) yazısıyla çizilmez; `font-mono` yalnızca kod/teknik yerlerde kalır.
- **Dükkân ekranı** (`buildings/OyuncuOfisiPanel.tsx` + `buildings/ShopDashboard.tsx`): her dükkân için bir kart (satış, kâr, raf doluluğu, "Rafları doldur", "Yönet"). "Yönet" eski ayrıntılı paneli (`EsnafAndTradePanel`) açar. Varlıklar ve işlem geçmişi Borsa ekranındadır.
- **Şirket sekmesi** (`TycoonGameView.tsx` + `buildings/SirketMerkeziPanel.tsx`): lacivert `g-hero` başlık kartı, tek satır alt sekmeler (Özet/Üretim/Ekip/Para/Gelişim; kimlikler `company-subtab-*` aynı). Fabrika ve Ar-Ge panelleri `company-factory-toggle` düğmesinin arkasındadır (DOM'da gizli durur).
- **İlk oyun rehberi** (`FirstRunGuide.tsx`): yalnızca 1. günde, bir kez gösterilen 4 adımlı açılış kartı; bitince `localStorage` anahtarı `first_run_guide_done_v1` işaretlenir (sunucu tarafında/testlerde hiç gösterilmez). **Kutlama** (`CelebrationOverlay.tsx`): dükkân sayısı ya da aşama artınca konfeti + kart (yalnızca görsel).
- Dükkân açılınca Dükkân ekranı otomatik dükkân kartlarına döner.
- **Şehirde dükkân kartı:** 3D şehirde dolu bir dükkân bloğuna dokununca panel açılmaz; `IsometricSelectionOverlay` içinde satış, kâr, raf doluluğu ve "Rafları doldur" (`selection-shop-restock-btn`) görünür, "Yönet" paneli açar (`ThreeNeighborhoodView.tsx`, `onRestockShop` → `TycoonGameView.handleRestockShop`). Kart önbellek tutmaz (açıkken rakamlar güncellenir). Testi `src/tests/city/shopSelectionCard.test.ts`. Not: bu kartın canlı tarayıcıda tıklayarak ekran görüntüsü doğrulaması yapılamadı (3D tuvalde isabetli tıklama zor); yalnızca test ve derleme doğrulandı.
- **Dükkân yönetim ekranı (Ticarium mantığı)** (`EsnafAndTradePanel.tsx`): üstte dükkân kartı üç büyük sayıyla (Kasa, Raf, Yolda); altında kasaya para koy / kâr al düğmeleri (5B/25B/100B), "Yoldaki siparişler" şeridi (kaç gün sonra gelir, "geldi") ve ipucu. "Mal al" her ürün için kart gösterir (en ucuz toptancı otomatik, +10/+50/+100); tedarikçi/ödeme seçimi "Gelişmiş sipariş" düğmesinin arkasındadır (DOM'da gizli, `shop-advanced-order-toggle`). Tek dükkânda dükkân seçici çipleri ve "Kariyerin" kutusu gizlidir (testid'ler durur). Üretim, sözleşme ve depo "Toptan & Üretim" modundadır (alt sekmeler: Depo ve alım, Kargo ve araç, Üretim, Anlaşmalar); her alt sekmenin başında tek satır `g-tip` vardır.
- **Açıklama balonu** (`ui/HelpTip.tsx`): küçük "?" düğmesi, dokununca tek cümlelik açıklama gösterir (kasa aktarma, yolda, kâr, memnuniyet).
- **Şehir üst şeridi** (`city/CityCameraControls.tsx`): sonraki olay kapsülü dar ekranda yalnızca emoji + süre gösterir (420 px ve üstünde yazı da gelir); yakınlaştırma etiketi de dar ekranda gizlenir. Üst çubukta para kutusu 360 px'te sığacak şekilde küçültüldü.
- **Bugünün görevleri** (`buildings/ShopDashboard.tsx`, `daily-tasks-card`): dükkân ekranının en üstünde, kayıt tutmadan dükkânların anlık durumundan türetilen iki görev (raflar yarıdan fazla dolu mu, bugün şu ana kadar kâr var mı: "Bugün kâra geçtin") ve "x/2" sayacı. Testi `src/tests/city/dailyTasks.test.ts`. Haftalık hedefler ve prestij henüz yok; eklenirse kayıt yapısı ve migration gerekir.
- **Banka / Ar-Ge / Haber panelleri** sade dile çevrildi: kısa başlıklar, `g-tip` açıklama ve `HelpTip` balonları; haberde "Yükseltir / Düşürür %x". Davranış ve `data-testid`ler değişmedi.
- **Az yazı ilkesi:** uzun açıklama, özet ve koşul listeleri varsayılan olarak kapalıdır, tek bir düğmenin arkasında durur (DOM'da gizli, testler okur): dükkân yönetiminde `shop-summary-details-toggle` (bugünün özeti + ipucu), `incorporation-toggle` (şirket kur koşulları), şirket Özet sekmesinde `company-summary-more-toggle` (durum özeti + öneriler). Eski yeşil "Rafları doldur" kartı gizlidir (dükkân kartı ve "Mal al" aynı işi yapar). Yeni ekran eklerken ilk bakışta en çok 3 büyük sayı ve 1–2 düğme göster, gerisini düğmenin arkasına koy.
- **Rahat oyun ilkesi (her ekranda geçerli):** ekranın büyük kısmı tek bir büyük sayı/kart olur (lacivert `g-hero`, altın 4xl–5xl rakam), altında en çok 3 küçük kutu ve büyük (min 48–56 px) `g-btn` düğmeler gelir; ayrıntı ve uzun açıklama yoktur ya da düğmenin arkasındadır. Sayfa aşağı uzayabilir, sıkışık küçük kutu olmaz. Dükkân alt ekranları (Fiyatlar/Çalışanlar/Geliştir/Yeni dükkân) ve Şirket sekmeleri (Üretim/Ekip/Para/Gelişim) bu ilkeyle yenilendi (Banka para taşı/kredi, Fabrika, Ar-Ge ve Holding da; Fabrika'daki depo/toptan bölümü `factory-trade-toggle` arkasında); eski `data-testid`ler (hire-*, shift-select-*, shop-hire-*, finance-action-* vb.) korundu, kullanılmayan girdiler `hidden` ile DOM'da kalır.
- **Sayı kutuları** (`ui/NumberInput.tsx`): oyundaki tüm `type="number"` kutuları bunu kullanır; yazarken silinip baştan yazılabilir, boşken üst bileşene değer gitmez, kutudan çıkınca değer düzelir. Yeni sayı kutusu için düz `<input type="number">` yazma, `NumberInput` kullan. Borsa'da lot sayısı da yazılabilir; "Hepsini al" ve "Hepsini sat" düğmeleri (`tycoon-lot-max-buy-btn`, `tycoon-lot-max-sell-btn`) lotu en fazla alınabilecek / eldeki kadar yapar.
- **Maaşlar:** dükkân çalışanlarının maaşı her gün dükkân kasasından otomatik düşer (`TradeAndShopEngine`, `todayPayrollCost`); şirket maaşları gün kapanışında ödenir (`DayCloseProcessor`). Dükkân "Çalışanlar" ekranında `shop-staff-wage-card` günlük maaşı gösterir, şirket "Ekip" sekmesinde günlük maaş kartı vardır.
- Alt menü adları: Şehir, Borsa, Dükkân, Şirket, Haberler, Rehber (kimlikler: `bottom-nav-city/market/portfolio/company/news`; Rehber bir sekme değil, `bottom-nav-guide` pencere açar).
- **Nasıl oynanır? rehberi** (`HowToPlayModal.tsx`): alt menüdeki "Rehber" düğmesi açar. 7 bölüm sekmesi (`how-to-play-tab-start/market/shop/company/holding/money/tips`), her bölümde numaralı kısa maddeler ve ilgili ekrana götüren düğme (`how-to-play-go-btn`; bina kilitliyse şehirde vurgulanır). Eşik ve oranlar ayar dosyalarından okunur (`gameBalance.ts`, `PROGRESSION_RULES`, `DECISION_LIFETIME_DAYS`); oyuna yeni bir sistem eklenince buradaki ilgili bölüme bir madde ekle. İlk oyun rehberinin son adımı Rehber'i anar. Testi `src/tests/ui/sectorPickerAndGuide.test.ts`.

## Tasarım sistemi (her yeni ekran buna uyar)

- **Renk dili tektir:** lacivert = yönetim/başlık, altın = para, yeşil = kazanç ve ana eylem, kırmızı = kayıp/tehlike. Değişkenler `src/index.css` başındaki `:root` (`--g-navy-*`, `--g-gold`, `--g-green`, `--g-red`, `--g-bg`, `--g-ink`, `--g-muted`, `--g-line`).
- **Hazır sınıflar** (`src/index.css`, `@layer components`): `g-card` (beyaz kart), `g-card-soft` (açık gri kutu), `g-hero` (her ekranın lacivert ana kartı) + `g-hero-label` / `g-hero-value` (altın büyük rakam) / `g-hero-tile`, `g-track` + `g-fill` (`g-fill-danger`) ilerleme çubuğu, `g-btn` + `g-btn-primary|gold|navy|danger|secondary|ghost` (basılınca çöken oyun düğmesi), `g-choice` (+ `is-active` ya da `data-active="true"`), `g-section-title`, `g-input`, `g-pill`, `g-tip` (ampul ikonlu ipucu), `g-display` (başlık/rakam yazısı), `g-rise` (ekrana giriş animasyonu).
- **Yasak:** her ekrana ayrı pastel gradyan, emojili düğme yazısı, `rounded-3xl bg-gradient-to-br from-x-100…` gibi tek seferlik renkler. Emoji yalnızca "ürün resmi" olarak kalır (dükkân türleri `SHOP_EMOJI`, ilk oyun rehberi, vardiya seçimi). Arayüz ikonları `lucide-react`; borsa sektörleri `ui/SectorIcon.tsx`.
- **Yazı tipleri pakete gömülü** (`@fontsource-variable/nunito` gövde, `@fontsource/baloo-2` başlık/rakam); internetten yüklenmez.
- **Kabuk:** üst çubuk lacivert, para kapsülü sayarak artar (`ui/useCountUp.ts`); alt menü lacivert, etkin sekme altın; sekme ekranlarında beyaz çerçeve yok, büyük başlık var. Bildirimler kalıcı şerit değil, 4 sn'lik alttan çıkan "toast" (`EventNotificationPanel.tsx`, `active-event-banner` testid'i DOM'da hep durur). Ayarlarda geliştirici araçları katlanır "Geliştirici araçları" bölümündedir; müzik kaydırıcısı gizli (müzik yok).
- **Ses ve titreşim** (`ui/feedback.ts`): dosyasız, tarayıcıda üretilen kısa sesler (`tap`, `coin`, `success`, `levelup`, `error`) + `navigator.vibrate`. Ayarlardaki Genel/Efekt düzeyi ve Sessiz'e uyar. `TycoonGameView` her düğmede `tap`, `g-btn-primary/gold` düğmelerde `coin` çalar; kutlama `levelup`, hata bildirimi `error`.
- **Sıradaki hedef şeridi** (`CityQuestStrip.tsx` + `city/questAndHudLogic.ts`, hedefler motorda `engine/CareerGoals.ts`): 31 hedeflik kariyer zinciri borsadan dükkânlara, şirkete, halka arza, devralmaya ve zenginler listesinde 1. sıraya kadar gider. Her hedefin **gerçek para ödülü** vardır: hedef bitince şeritte altın "Ödülü al" düğmesi (`quest-claim-btn`, nabız animasyonu `quest-claim-pulse`) çıkar; `SimulationEngine.claimCareerGoal` → `App.handleClaimCareerGoal`. Sıra önemlidir: gösterilen hedef, ödülü alınmamış ilk hedeftir. Tamamlanma her an durumdan hesaplanır; yalnızca alınan ödüller kaydedilir (`state.careerGoals`). Eski kayıt ilk açılışta zaten tamamlanmış hedefleri ödülsüz alınmış sayar (`migrateCareerGoalsForLegacySave`). Ödül tutarları `npm run kariyer` ile ayarlandı (1 milyona kadar toplam ~315 bin ₺). Hedef ekleyip çıkarırsan testlerdeki hedef sayısını (31) güncelle. Testleri `src/tests/ui/careerGoals.test.ts`, `designSystem.test.ts`.
- **Zenginler listesi** (`engine/RichListEngine.ts`, pencere `RichListModal.tsx`): kayıt tutmayan, durumdan türetilen 29 kişilik liste: 12 uydurma "mahalle zengini" (140 bin–19 Mn, yılda %25 büyür) + her borsa şirketinin uydurma kurucusu (servet = kurucu payı × şirketin borsa değeri; oyuncu şirketi devralınca listeden çıkar) + oyuncu. Açılış: üst çubuktaki para kartı (`tycoon-top-rich-rank`) ya da hedefler penceresi (`quest-open-rich-list-btn`). Oturumda en iyi sıra geçilince `CelebrationOverlay` kutlar (`richRank`). Oyuncunun şirketi varsa aynı sektördeki kurucular "Rakibin" diye işaretlenir; bir rakip devralınınca kurucunun adıyla kutlama çıkar (`takeovers`, `founderNameForTicker`).
- **Kariyer hızı ölçümü:** `npm run kariyer` (`scripts/kariyer-hizi.ts`) sıfırdan oynayan robotla her önemli anın gerçek dakikasını ve hedef ödüllerinin hangi dakikada alındığını yazar. Şu an (1x): ilk dükkân 2 dk, 2. dükkân ~1 sa, 1 milyon ~5 sa, şirket kapısı 5,9–6,3 sa (eskiden ilk dükkân 32–44 sa, şirket ~97 sa). Tempo ya da ödülleri değiştirince önce/sonra çalıştır.
- Toplu yeniden stil için kullanılan dönüştürücü depoda değildir; yeni kodda doğrudan yukarıdaki sınıfları yaz.

## Karar kartları (rastgele olaylar)

- Motor: `engine/DecisionEventEngine.ts`, tipler `models/decisions.ts`, kayıtta `state.decisionEvents` (eski kayıtlarda yoktur; `ensureDecisionState` ve `simulationStore.ts` göçü oluşturur).
- Gün kapanışında (`DayCloseProcessor`, ticaret adımından hemen sonra) en erken 3. gün, iki olay arasında en az 2 gün ve ~%50 olasılıkla bir kart çıkar; kart 2 gün açık kalır, sonra "karar verilmedi" sayılır. Seçim tohum + günden hesaplanır (`decisionHash`), motorun sayı üretecine dokunmaz; aynı kayıt aynı olayları üretir.
- 12 şablon (`DECISION_TEMPLATES`): 10'u dükkân ister (festival, kötü yorum, zam isteği, denetim, su borusu, gazete, toplu sipariş + 3 **rakip hamlesi**: `rival-next-door` karşına dükkân açtı, `rival-poach` çalışanını istiyor, `rival-price-war` fiyat savaşı), 2'si her zaman çıkabilir (kuzen ortaklığı, eski borç). Rakip kartları yalnızca en az `RIVAL_MIN_SHOPS` (2) dükkânı olan oyuncuya çıkar (`minShops`; tek büfeyle başlayana çok sert geliyordu: 2. dükkânı ~1 saatten ~2 saate itiyordu, ölçüldü). Rakip adı zenginler listesinin ilk beş mahalle zengininden seçilir (`RichListEngine.localRivalName`). Son 3 kart tekrar etmez. Testi `src/tests/decisions/rivals.test.ts`.
- Etkiler: `CASH` (kişisel nakit, WalletEngine + merkezi defter kaydı), `SATISFACTION` (dükkân memnuniyeti), `DEMAND_BOOST` (dükkânda geçici müşteri çarpanı, `ShopInstance.demandBoost`, `TradeAndShopEngine` müşteri hesabında çarpılır), `DELAYED_CASH` (ileride gelecek/gidecek para; şans sonucu karar anında belirlenir, `scheduledPayouts`).
- Tutarlar ölçeklidir: dükkân olaylarında günlük cironun ~%30'u (800–30.000 ₺), kişisel olaylarda net varlığın ~%2'si (1.000–40.000 ₺). Parası yetmeyen seçenek seçilemez.
- Arayüz: `components/game/DecisionCard.tsx` (lacivert kart, iki büyük seçenek, "Sonra karar ver" ile sağ altta altın "Karar bekliyor" kapsülüne küçülür). `SimulationEngine.resolveDecisionEvent('A'|'B')` → `App.tsx handleResolveDecision` → `TycoonGameView onResolveDecision`. Testi `src/tests/decisions/decisionEvents.test.ts`.
- Kart 2 gün içinde cevaplanmazsa B seçeneği kendiliğinden uygulanır ("Karar verilmedi, … sayıldı"; `applyEffects` ortak fonksiyonu). `npm run balans` kartlara `decisionBot.ts` ile cevap verir.
- Kayıttan yükleme `decisionEvents` alanını artık korur (eskiden yeniden yüklemede bekleyen kart kayboluyordu).

## Dükkân müdürü (otomatik yönetim)

- Motor: `engine/ShopManager.ts`; kayıtta `ShopInstance.manager` (eski kayıtlarda yoktur, alan yoksa müdür yok demektir). Ayarlar `data/gameBalance.ts`: `MANAGER_MIN_SHOP_LEVEL` (2), `MANAGER_WAGE_MULTIPLIER` (sabit maaş = çalışan maaşı × 0,2), `MANAGER_PROFIT_SHARE` (müdürden önceki günlük kârın %15'i prim, zarar gününde prim yok), `MANAGER_HIRE_FEE_DAYS` (işe alma = 30 günlük sabit maaş), `MANAGER_CASH_RESERVE_DAYS`, `MANAGER_SWEEP_TRIGGER_MULT`.
- İşe alırken (`hireManager`) kişisel nakitten işe alma ücreti düşer; dükkân kasası önerilen işletme parasının (`recommendedWorkingCash`: birkaç günlük gider + rafları bir kez doldurma) altındaysa eksik kısım cepten kasaya konur. Şirket şubelerine müdür tutulmaz (onlar zaten depodan beslenir).
- Maaş + prim dükkânın günlük personel giderine eklenir (`TradeAndShopEngine`, `todayPayrollCost`, `manager.todayBonus`).
- Gün kapanışında (`DayCloseProcessor`, ticaret adımından sonra, karar kartlarından önce) `runManagers`: rafları `planShopRestock` ile YALNIZCA dükkân kasasındaki parayla doldurur (kasada `MANAGER_CASH_RESERVE_DAYS` günlük gider bırakır, oyuncunun cebine dokunmaz); `sweepProfits` açıksa kasa ayrılan payın 3 katını geçince fazlasını oyuncuya aktarır. Kasa boş ve raflar azsa `manager.lowCash` olur, kartta kırmızı uyarı çıkar.
- Arayüz: dükkân kartında altın "Müdür" rozeti ve "Müdür: …" satırı (`ShopDashboard.tsx`); "Yönet → Çalışanlar" ekranının başında müdür kartı (`shop-manager-box`, `shop-manager-hire-btn`, `shop-manager-sweep-toggle`, `shop-manager-fire-btn`). Müdürlü dükkânlar "Bugünün görevleri" raf görevine sayılmaz. Akış: `SimulationEngine.hireShopManager / fireShopManager / setShopManagerSweep` → `App.tsx` → `TycoonGameView` → `OyuncuOfisiPanel` → `EsnafAndTradePanel`.
- Testi `src/tests/decisions/shopManager.test.ts`.

## Dükkân çalışma saatleri ve gün içi satış

- Veri ve yardımcılar `src/data/shopHours.ts`: `SHOP_HOURS` (büfe 07–23, manav 07–21, kafe 08–24, giyim/elektronik 10–22, mobilya 10–20, market 08–23, galeri 09–19), `shopOpenStatus(tür, günİçiDakika)` → "Açık · 23:00'e kadar" / "Kapalı · 07:00'de açılır" (Türkçe saat ekleri tablodan), `shopHoursLabel`. Şirket şubeleri de aynı saatleri izler.
- **Satış gün içinde parça parça** (`engine/ShopSales.ts`): `SimulationEngine.processIntradayStep` her 5 oyun dakikasında `stepShopsIntraday` çağırır; her dükkân açık saatlerinin geçen oranı (`openFractionElapsed`) kadar satar, para kişisel dükkânın kasasına hemen girer (şirket şubelerinde gün sonunda şirkete yazılır). Canlı sayaçlar `ShopInstance.live` (`ShopLiveDay`, eski kayıtlarda yoktur, kendiliğinden oluşur). Küsurat birimler en yakına yuvarlanıp taşınır; gün toplamı kaybolmaz.
- Gün kapanışında `TradeAndShopEngine.stepDailyTradeAndShops` → `finishShopDay` günün kalan kısmını satar (hızlı ilerletme/çevrimdışında bütün gün burada), toplamı `today*` alanlarına yazar (yani `today*` = **biten günün** sonucu; rapor, müdür, karar kartları bunu okur), kira/maaş/fire düşer ve gün içinde kasaya girmemiş satışı ekler. Talep formülü `computeShopDailyDemand` (eskisinin aynısı; olağanüstü olay çarpanı en sonda, küsuratlı uygulanır).
- Denge değişmedi: canlı oynanan gün ile hızlı ilerletilen gün kuruşu kuruşuna aynı (`src/tests/simulation/shopIntradaySales.test.ts`), `npm run balans` çıktısı önce/sonra birebir aynı.
- Arayüz: dükkân kartında "Bugünkü satış / Bugünkü kâr" canlı (`liveShopToday`; kâr = satış − mal maliyeti − günün geçen kısmı kadar gider), altında "Dün: … satış · … kâr" (`shop-card-live-revenue-*`, `shop-card-yesterday-*`). Şehirdeki dükkân kartı da canlıdır. "Bugünün görevleri" kâr görevi canlı kâra bakar. Dükkân yönetimindeki "Bugünün özeti" (düğme arkasında) biten günü "Dünkü" diye gösterir.
- Saat gösterimi: dükkân kartı (`shop-card-hours-*`), yönetim kartı (`active-shop-hours`), şehirdeki kart (`selection-shop-hours`), yeni dükkân seçimi (`shop-type-hours-*`). Testi `src/tests/ui/shopHours.test.ts`.

## Olağanüstü olaylar (savaş, salgın, faiz, petrol, siber saldırı)

- Veri `src/data/worldEvents.ts` (`WORLD_EVENT_TEMPLATES`, 10 olay = 5 ayna çift: savaş↔barış, salgın↔aşı, faiz indirimi↔artışı, siber saldırı↔teknoloji atılımı, petrol krizi↔petrol bolluğu), tipler `models/worldEvents.ts`, motor `engine/WorldEventEngine.ts`, dükkân etkisi `engine/WorldEventEffects.ts`. Kayıtta `state.worldEvents` (eski kayıtlarda yoktur; `ensureWorldEventState`; kayıt/yükleme alanı taşır).
- Gün kapanışında adım 3B (`stepWorldEvents`, haber üretiminden sonra, sentiment hesabından önce): en erken `WORLD_EVENT_FIRST_DAY` (12), iki olay arası en az `WORLD_EVENT_MIN_GAP_DAYS` (18), sonra her gün `WORLD_EVENT_DAILY_CHANCE` (1/12) → ölçülen ortalama ~29 günde bir. Seçim ve ülke adları tohum + günden (`wHash`), motorun sayı üretecine dokunmaz. Ülke adları uydurma (`makeCountryName`, hece birleştirme; gerçek yere benzeyenler `BLOCKED`).
- Etkiler: borsa → sektör başına "SON DAKİKA" haberi (`NewsEvent.worldEventId`, `WORLD_EVENT_DECAY` 0,12 ile yavaş söner); toptancı fiyatı → `WORLD_EVENT` ticari olayı (`priceImpactMultiplier`); dükkân müşterisi → `worldEventShopDemandMultiplier` (ShopSales'te yuvarlamadan SONRA uygulanır, küsurat `live.carry` ile günden güne taşınır). Dükkân/toptancı etkisi `WORLD_EVENT_SHOP_DAYS` (7) gün.
- Denge: aynalar borsada tam ters (`sectorImpacts`), dükkân/toptancı çarpanlarında 1'in öbür yanına eşit uzaklık (0,8 ↔ 1,2; 1/x kullanma, ortalaması 1'in üstünde kalır). `src/tests/market/worldEvents.test.ts` denetler. Ölçülen 10 günlük etkiler: savaşta savunma ~+%12, faiz indiriminde bütün borsa ~+%10, salgında biyoteknoloji ~+%19. Borsanın yıllık ortalaması değişmedi (hisse ort. %71–93). Dükkân kârı 6 tohumla eski koda göre: çoğu +%1–7, elektronik +%13, galeri +%14 (ucuzken stok yapan robot kazanıyor). `npm run balans` dükkânları tek tohumla ölçtüğü için o çıktıdaki oynama büyük görünür (büfe 43→34 gün): bunun çoğu sayı üretecinin kaymasıdır.
- Arayüz: `components/game/WorldEventCard.tsx` — oyun açıkken olay başlayınca kırmızı "SON DAKİKA" kartı (`world-event-card`, `world-event-title`, `world-event-news-btn` Haberler sekmesine gider; kayıt açılışında eldeki olay görülmüş sayılır) ve etki listesi `WorldEventEffectsList` (sektör ▲▼, dükkân müşteri %, toptan fiyat %, kalan gün). Haberler ekranında son 14 günün olayları en üstte kart (`news-world-event-*`), olay haberleri listede tekrar gösterilmez. Rehber → Borsa ve Dükkân'da birer madde.

## Gün sonu raporu

- Gün oyun saatiyle 00:00'da kapanır (`DayCloseProcessor.closeCurrentDay`, adım 16). Biten günün özeti `engine/DayReportEngine.ts` (`buildDayReport`) ile çıkarılır ve `state.lastDayReport` içinde saklanır (tip `DayReport`, `models/simulation.ts`; eski kayıtlarda yoktur; kayıt/yükleme `simulationStore.ts` ve `restoreFromSavedState` alanı taşır). Yalnızca okur, ekonomiyi değiştirmez.
- İçerik: net varlık başı/sonu (başlangıç bir önceki gün kaydından), şirket günlük satış/gider/kâr (muhasebedeki yıllık tutar ÷ 120) ve pazar payı, kişisel dükkânlar (şubeler hariç) satış/kâr/müşteri, borsa kârı (portföy değer farkı − o günkü alış + satış), en çok kazandıran/düşen hisse, temettü, holding kazancı, servet vergisi.
- Arayüz `components/game/DayReportCard.tsx`: gün dönünce sol altta altın kapsül (`day-report-capsule`, `coin` sesi), dokununca kart (`day-report-card`, `day-report-delta`, `-company`, `-shops`, `-market`, `-extras`, `-other`, `day-report-close-btn`). Kendiliğinden açılmaz (günler 2 dk sürdüğü için bilinçli). **Rekor gün:** günün toplam varlık artışı önceki rekoru en az %15 geçerse (`markRecordDay`, `RECORD_DAY_MARGIN`, 5. günden sonra) kapsül altın kupa ve "Rekor gün!" yazısıyla çıkar (`day-report-record`, `levelup` sesi); rekor `state.records`'ta. Kutuların dışında kalan değişim "Diğer (şirket değeri, faiz, kira…)" satırında gösterilir, böylece rakamlar toplamla uyuşur. Kayıt yeni açılınca eldeki rapor görülmüş sayılır (yalnızca oyun açıkken dönen günler kapsül çıkarır). Ayarlarda `settings-day-report-toggle` (`uiSettings.showDayReport`) kapatır. Testi `src/tests/ui/dayReport.test.ts`.

## Tekrar hoş geldin penceresi

- `OfflineProgressModal.tsx`: lacivert kart, büyük altın "+₺" net varlık farkı, gelir/gider/temettü kutuları ve altın "Topla ve devam et" düğmesi (`offline-modal-continue-btn`).

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
- Geç oyun dosyaları: `SectorMarket.ts` (sektör pazarı), `TaxRules.ts` (vergi hesabı), `WealthTaxEngine.ts` (servet vergisi tahsili), `BalanceMigration.ts` (eski kayıt göçü). Hepsi yalnızca alt motorları içe aktarır.
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
| `ThreeCityScene.ts` | Sahne: kamera, ışık (sabah/gün/akşam/gece), yollar, araçlar, ağaçlar, tıklama ve üzerine gelme. Kamera sabit açılıdır (aşağıya bak). |
| `models.ts` | Binaların 3D modelleri (8 ana bina, dükkân türleri, şehir blokları, kilitli/inşaat arsaları). |
| `kit.ts` | Ortak yapı taşları: malzeme, pencere dokuları, ağaç, araba, lamba. |
| `webgl.ts` | Tarayıcı 3D destekliyor mu kontrolü. Testler ve sunucu tarafı için hep "hayır" döner, yani testler eski görünümü kullanır. |

Kurallar ve notlar:
- **Kamera sabit açılı (Clash of Clans / Hay Day gibi):** `MapControls`, döndürme ve eğme kapalı; tek parmak/sol tık sürükleyince zeminde kayar, iki parmak/tekerlek yakınlaştırır (imlece doğru). Açı `VIEW_DIR` (~50° yukarıdan, hafif çapraz), uzaklık 90–290, kaydırma sınırı hedef x ±72, z −52..58. Şehir kutusu ekranı doldurur (`h-[calc(100dvh-236px)]`).
- **Performans:** gölge haritası her karede değil yalnızca sahne değişince yeniden çizilir (`shadowDirty`; bina eklenip çıkınca, dekor değişince, güneş yer değiştirince). Araç ve yayalar gölge düşürmez. Etiketler (CSS2D) yalnızca kamera ya da etiket değişince yeniden yerleştirilir (`labelsDirty`). Kare süresi uzun kalırsa çözünürlük kademeli düşer, rahatlayınca geri çıkar (`adaptResolution`). Retina ekranda kenar yumuşatma kapalı, gölge PCF ve en çok 2048. Dokunmatikte üzerine gelme (hover) taraması yapılmaz. Ölçüm: yazılımsal grafik motorunda 390×844, DPR 2 ekranda eski sürüm ~4 kare/sn, yeni ~11 kare/sn.
- 3D modeller kodla üretilir (düşük poligonlu). Eski "bina kodla çizilmez / PNG iste" kuralı yalnızca eski izometrik görünüm içindir;
  PNG bina görselleri (`public/buildings/`, `buildingSprites.ts`) ve zemin/yol notları da sadece eski görünümü etkiler.
- Harita koordinatları eski görünümle aynıdır (1600×1200 birim → 3D dünyada ×0,1). Yollar ve araç rotaları `ThreeCityScene.ts` içindeki
  `ROADWAYS`, `ZONES`, `ROUTES` sabitlerinde; yolu oynatırsan rotaları da güncelle.
- Dükkân türüne göre model: MARKET, KAFE, BUFE, MANAV, GIYIM_MAGAZASI, ELEKTRONIK_MAGAZASI, MOBILYA_MAGAZASI, OTOMOBIL_GALERISI hepsinin 3D modeli var.
  Boş dükkân arsası "DÜKKÂN AÇ" çimenlik arsa olarak görünür; boş `urban-ticaret-otel-5` Butik Otel olur.
- **İsim etiketleri varsayılan olarak gizli (Clash of Clans gibi):** bir binaya/bloğa dokununca adı belirir, `LABEL_FLASH_MS` (2,8 sn) sonra yavaşça söner (`flashLabel`, `flashKey`); bilgisayarda fare üzerine gelince de görünür. Sönen etiket ayrıca `visible=false` yapılır ki görünmeyen yazılar kamera hareketinde yer hesaplamasın. Ana binaya dokununca paneli de açılır (etiket panelin arkasında kalır).
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

- Dükkânlar açılış sırasıyla `SHOP_SLOT_ORDER` (`cityLayout.ts`) bloklarına yerleşir: ilk üçü `urban-ticaret-magaza-1`, `urban-ticaret-kafe-2`, `urban-ticaret-otel-5`; 4.–8. dükkân Ticaret Hanı, iki konut ve iki genişleme arsasını oyuncunun dükkânına çevirir (şehir görünür biçimde büyür). Sıradaki boş yer `shopLot` ile "DÜKKÂN AÇ" arsası olur. 3D'de oyuncunun her dükkânında altın bayrak ve seviye kadar altın küp vardır (`ownerFlag`, `city3d/models.ts`). 8'den fazla dükkân haritada gösterilmez. Testi `src/tests/city/shopSlotsGrowth.test.ts`.
  Hangi bloğun hangi görseli göstereceği artık bloğun adından değil, içindeki dükkânın türünden gelir.
- Blokta dükkân yoksa (boş arsa) bloğun eski varsayılanı görünür: 1. blok market, 2. blok kafe, 3. blok eski çizim.
- Yeni tür görseli eklemek: PNG'yi `public/buildings/` içine koy, `SHOP_TYPE_SPRITES` içine tür adıyla bir satır ekle.

## Bilinen eksikler

- 8'den fazla dükkân şehirde görünmez (yalnızca 8 dükkân yeri var). Prestij (yeniden başlama) henüz yok; rakip patronlar şimdilik karar kartı ve zenginler listesiyle sınırlı (şirket döneminde kendiliğinden hamle yapmazlar) (öneri listesinde sırada).
- 3D şehirde yayalar üç kaldırım rotasında yürür (`WALK_PATHS`); her rotadaki ilk 3 yaya arada Borsa, Banka ya da Haber Merkezi'nin kapısına girip çıkar (`WALK_DOORS`). Diğer binalara girmezler. Eski görünümdeki olay/nabız efektleri 3D'de yok.
- 3D modeller basit ve düşük poligonlu; ana binaların ayrıntısı artırılabilir ya da sahibinin vereceği hazır 3D model dosyalarıyla (.glb) değiştirilebilir.
- Gerçek uygulamada uzun süre kapalı kalıp açınca "Tekrar hoş geldin" penceresinin kendiliğinden çıkıp çıkmadığı denetlenmedi; pencere Ayarlar → Geliştirici araçları → "Çevrimdışı ilerlemeyi dene" ile görülebilir.
- Eski izometrik görünümde (klasik mod): Haber Merkezi, Merkez Bankası ve Holding tabanı yola yakın; 6 dükkân türü
  (büfe, manav, giyim, elektronik, mobilya, galeri) ve kalan ana binalar/şehir blokları PNG yerine eski kutu çizimiyle duruyor;
  bir dükkân görseli yüklenemezse o blok oturum boyunca eski çizimde kalır.

## Çalışma kuralları

- Ekonomi motorlarına dokunan her değişiklikten sonra `npm test` çalıştır.
- Görsel değişiklikten sonra projeyi derleyip gerçek ekran görüntüsüyle kontrol et; yalnızca derlenmesi yetmez.
- `data-testid` değerlerini testler kullanıyor; kaldırmadan önce `src/tests/` içinde ara.
- Kayıt yapısını değiştirirsen `simulationStore.ts` içindeki migration'ı da güncelle; eski kayıtlar bozulmamalı.
