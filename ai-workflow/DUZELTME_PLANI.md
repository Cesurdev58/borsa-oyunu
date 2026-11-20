BORSA OYUNU - OYUN EKONOMISI, QA VE UX DUZELTME TALIMATI
Claude Code / AI Studio Uygulama Promptu

ROL
Bu projeyi deneyimli bir Oyun Ekonomisi, TypeScript, Three.js, QA ve Mobil UX uzmani olarak ele al. Amacin yalnizca yorum yapmak degil, asagidaki duzeltmeleri mevcut mimariyi bozmadan gercekten uygulamak, test etmek ve sonuclari raporlamaktir.

PROJE
React + TypeScript tabanli borsa, esnaflik, sirket ve sehir yonetimi oyunu.

TEMEL KURALLAR
1. Mevcut kayit dosyalariyla geriye uyumlulugu koru.
2. Para islemlerinde iki ondalik hassasiyet ve idempotency kurallarini koru.
3. Yeni sabitleri mumkun oldugunca src/data/gameBalance.ts icinde merkezi olarak tanimla.
4. Is kurallarini React bilesenlerinin icine gommek yerine engine/data katmaninda tut.
5. Her kritik degisiklik icin otomatik test ekle.
6. npm run lint, npm test, npm run balans ve npm run kariyer komutlarini calistir. Hata cikarsa sebebini duzeltmeden isi tamamlanmis sayma.
7. Dosyalari topluca yeniden yazma. Gereken yerlere kontrollu ve kucuk degisiklikler yap.
8. Sonunda degisen dosyalari, davranis degisikliklerini, test sonuclarini ve kalan riskleri raporla.

============================================================
1. TEMPO VE ILK 30 DAKIKA DENGESI
============================================================

HEDEF SURELER
- Ilk dukkan: 4-6 gercek dakika
- Ilk kucuk dukkan yukseltmesi: 8-12 gercek dakika
- Ilk manuel calisan: 12-18 gercek dakika
- Ilk dukkan seviye yukseltmesi: 18-25 gercek dakika

INCELENECEK ANA DOSYALAR
- src/data/gameBalance.ts
- src/engine/TempoRules.ts
- src/engine/ProgressionRules.ts
- src/engine/FirstShopGate.ts
- src/engine/ShopOperations.ts
- src/engine/ShopSales.ts
- src/data/tradeCatalog.ts
- scripts/balans-olcumu.ts
- scripts/kariyer-hizi.ts

YAPILACAKLAR

A. Ilk dukkan kapisini gercek bir mini egitime cevir.
Mevcut sistem iki farkli sektorden hisse alip bir hisse satildiginda ayni dakika icinde tamamlanabiliyor. Su kosullari uygula:
- En az bir hisse satin alinmis olmali.
- Ikinci ve farkli bir sektorden hisse satin alinmis olmali.
- En az bir pozisyon satilmis olmali.
- En az bir piyasa fiyat guncellemesi veya bir oyun gunu gorulmus olmali.
- FirstShopGateStatus icinde bu yeni adimi gorunur hale getir.
- Eski kayitlarda alan yoksa guvenli varsayilan kullan.
- FIRST_SHOP_MIN_NET_WORTH zengin oyuncu/test kisayolu olarak kalabilir.

B. Ilk calisani otomatik ve gorunmez sekilde verme.
Mevcut acilista shop.staffCount dogrudan minStaffRequired degerine ayarlaniyorsa bunu degistir:
- Ilk dukkan olan BUFE acildiginda oyuncunun kendisi calisiyor kabul edilsin.
- Baslangictaki personel kapasitesi normal kapasitenin yaklasik %65'i olsun.
- Ayri bir "Ilk calisanini ise al" aksiyonu ve kariyer hedefi ekle.
- BUFE ilk ise alma bedeli 2.000 TL civarinda olsun. Kesin degeri gameBalance.ts sabitinden yonet.
- Gunluk ucret mevcut staffDailyWagePerPerson degerinden devam etsin.
- Calisan alindiginda normal personel yeterlilik hesabi devreye girsin.
- Diger dukkanlarin acilis davranisini bozma. Gerekirse sadece ilk dukkan/BUFE icin kontrollu onboarding kurali kullan.

C. Isletme sermayesi uyarisini ekle.
- BUFE kurulum maliyeti 25.000 TL acilis + 10.000 TL dekorasyon olarak kalabilir.
- Acilis ekraninda "Onerilen isletme sermayesi: 15.000 TL" bilgisini goster.
- Oyuncu acilistan sonra 15.000 TL altinda likit parayla kalacaksa engelleme yerine guclu uyari ve ikinci onay kullan.
- Stok, kira ve ucretlerin kac gun karsilanabildigini hesaplayan kisa bir bilgi goster.

D. Yukseltme metriklerini ayir.
"Ilk yukseltme" tek metrik olmasin:
- Ilk kucuk yukseltme
- Ilk dukkan seviye yukseltmesi
- Ilk manuel calisan
- Ilk stok tukenmesi
- Ilk negatif gunluk nakit akisi
scripts/kariyer-hizi.ts bu kilometre taslarini ayri ayri raporlasin.

E. Kariyer botunu daha gercekci yap.
- Baslangic parasinin %95'ini otomatik olarak borsaya yatirmak yerine makul bir nakit rezervi biraksin.
- Dukkan acilisi ve stok siparisi icin minimum likidite rezervi kullansin.
- Kucuk yukseltme ile seviye yukseltmesini ayri raporlasin.
- Cikti gercek dakika, oyun gunu, mevcut nakit, net deger ve dukkan sayisini gostersin.

F. Tempo dogrulamasi.
- Hizli baslangicta erken donem 2 gercek dakika / oyun gunu kalabilir.
- Ilk 30 dakikada bildirim ve karar karti yigilmadigini kontrol et.
- Gerekirse ilk 5 oyun gununde karar karti ve olay frekansina onboarding carpanini uygula.

KABUL KRITERLERI
- Optimize edilmemis makul bot 4-6 dakikada ilk dukkanini acabilmeli.
- Ilk kucuk yukseltme 8-12 dakika, ilk manuel calisan 12-18 dakika bandinda olmali.
- Oyuncu ilk dukkani actigi anda ucretsiz calisan kazanmamali.
- Kariyer olcum raporu tum yeni kilometre taslarini ayri gostermeli.

============================================================
2. EKONOMI TUTARLILIGI VE EXPLOIT DUZELTMELERI
============================================================

INCELENECEK ANA DOSYALAR
- src/engine/ShopSales.ts
- src/engine/ShopUpgrades.ts
- src/engine/BankLoanEngine.ts
- src/engine/MarketEngine.ts
- src/engine/DayCloseProcessor.ts
- src/engine/CentralLedgerEngine.ts
- Ilgili kredi, piyasa ve dukkan testleri

A. Kredi taksit modelini tutarli hale getir.
Mevcut sistemde toplam faiz bastan installmentAmount icine eklenirken odeme gununde accruedInterestUnpaid yeniden taksite ekleniyor olabilir. Bunu tek bir modele indir.

Tercih edilen model: azalan bakiyeli annuite.
- Donem faizi: r = annualInterestRate * installmentFrequency / 365
- Taksit: payment = P * r * (1+r)^n / ((1+r)^n - 1)
- r sifirsa payment = P / n
- Her odemede:
  interestPortion = remainingPrincipal * r
  principalPortion = min(remainingPrincipal, payment - interestPortion)
- Gunluk faiz tahakkuku korunacaksa ayni faizi bir daha installmentAmount icine bastan ekleme.
- Teklif, sozlesme ve gercek tahsilat ayni amortisman planindan uretilsin.
- Son taksitte kurus farkini temizleyerek remainingPrincipal tam sifir olsun.

B. Yilliklastirma standardini birlestir.
- Banka kredisi ve banka disi borclar icin 365 gun standardi kullan.
- /252 kullanan eski borc faizi hesaplarini /365 ile uyumlu hale getir.
- Bu degisikligin eski kayit borclarini aniden patlatmamasini sagla.

C. Kullandirim ucretini acik ve tutarli goster.
- Origination fee pesin kesiliyorsa net disbursement = principal - fee olarak kalabilir.
- totalRepayment tanimi yalnizca gelecekteki taksitleri mi, yoksa pesin ucret dahil toplam maliyeti mi gosterdigini acikca ayirsin.
- Arayuzde su alanlari ayri goster:
  - Ana para
  - Pesin kullandirim ucreti
  - Hesaba gecen net tutar
  - Toplam faiz
  - Toplam taksit odemesi
  - Kredinin toplam maliyeti

D. Asiri fiyatlandirma exploit'ini kapat.
ShopSales fiyat esnekliginde talep her durumda %8 tabaninda kalmasin.
Onerilen davranis:
- priceRatio <= 1.5: mevcut elastik formule yakin davranis
- 1.5 < priceRatio <= 2.0: talep carpani en fazla 0.05
- 2.0 < priceRatio <= 3.0: talep carpani en fazla 0.01
- priceRatio > 3.0: normal talep 0
- Ozel olay/musteri sistemi varsa cok dusuk satis yalnizca acik bir event uzerinden gelebilir.
- Negatif, NaN veya sonsuz satis fiyatlarini reddet.

E. Isletme kredilerinin borsaya aktarilmasini engelle.
- Isletme/stok kredisi ayri bir kisitli hesaba veya fon bakiyesine yatsin.
- Bu para sadece stok, kira, personel, dekorasyon, lojistik ve dukkan yukseltmelerinde kullanilabilsin.
- Hisse alimi, luks harcama ve oyuncuya nakit transferi icin kullanilamasin.
- Genel amacli bireysel kredi varsa daha yuksek faizle serbest kalabilir.
- Mevcut kayitlarda kisitli bakiye alani yoksa sifirla baslat.

F. Temerrut ve idempotency korumasi.
- Ayni kredi ve ayni odeme donemi icin payLoanInstallment birden fazla cagrilsa bile yalnizca bir tahsilat veya bir gecikme kaydi olussun.
- Basarisiz transfer her UI renderinda missedPaymentCount artirmamali.
- Gecikme sayaci yalnizca gercek vade gunu ilerlediginde bir kez artsin.
- Uc farkli vade kacirilinca DEFAULTED olsun; ayni vadenin uc tekrar cagrisi temerrut yaratmasin.

G. Otomatik ekonomi testleri ekle.
En az su testleri yaz:
1. Ayni gun kredi cek, hisse al, sat, krediyi kapat: net deger artisiyla sonsuz para olusmamali.
2. 100 farkli seed ve 360 oyun gunu kredi amortisman testi: teklif edilen toplam ile gercek tahsilat arasinda en fazla 1 TL yuvarlama farki olmali.
3. Fiyat adil fiyatin 10 kati yapildiginda surekli pozitif dukkan kari olusmamali.
4. Ayni idempotency key ile taksit 10 kez cagrildiginda tek tahsilat olmali.
5. Ayni vade icin yetersiz bakiye fonksiyonu 10 kez cagrildiginda missedPaymentCount yalnizca bir artmali.
6. Son taksitte remainingPrincipal ve accruedInterestUnpaid sifirlanmali.
7. Reserved order cash kredi odemesi veya yukseltme tarafindan harcanmamali.

KABUL KRITERLERI
- Kredi teklifindeki toplam odeme gercek tahsilatla uyusmali.
- Kredi-hisse-dongusuyle risksiz pozitif para uretilememeli.
- Isletme kredisi borsada kullanilamamali.
- Asiri fiyatla satis normal talebi sifira yaklastirmali.
- Ayni vade tekrar cagrilari haksiz temerrut yaratmamali.

============================================================
3. SEHIR HARITASI, YOL CAKISMALARI VE 3D ASSET KALITESI
============================================================

INCELENECEK ANA DOSYALAR
- src/components/game/city/cityLayout.ts
- src/components/game/city3d/ThreeCityScene.ts
- src/components/game/city3d/assets.ts
- src/components/game/city3d/models.ts
- public/models/**

A. Tek koordinat kaynagina gec.
Su anda bina konumlari cityLayout.ts, yol konumlari ThreeCityScene.ts icindeki ayri ROADWAYS dizisinden geliyor. Bunlari ortak bir veri modelinde birlestir.

Onerilen tipler:
interface CityLot {
  id: string;
  center: { x: number; z: number };
  size: { width: number; depth: number };
  allowedFootprint: { width: number; depth: number };
  facing?: number;
}

interface CityRoad {
  id: string;
  from: { x: number; z: number };
  to: { x: number; z: number };
  width: number;
  kind: 'MAIN' | 'SERVICE' | 'DRIVEWAY';
}

- 2D layout ve 3D sahne ayni CityGridDefinition verisini kullansin.
- ROADWAYS icindeki kopya koordinatlari kaldir veya ortak dosyadan uret.
- Harita biriminden dunya birimine donusum tek fonksiyonda olsun.

B. fitClearOfRoads algoritmasini duzelt.
Mevcut 49 noktalik ornekleme uzun/capraz yollarda kacirma yapabilir.
- Nokta orneklemesi yerine segment-AABB minimum mesafe veya OBB/SAT tabanli test kullan.
- Yol genisligi + en az 0.5-1.0 dunya birimi kaldirim boslugu hesaba katilsin.
- Bir model yol ile cakisiyorsa rastgele/parsel disina itmek yerine once allowedFootprint icine sigacak sekilde olcekle.
- Model parsel disina cikamaz.
- Komssu parsellerle veya binalarla yeni cakisma yaratamaz.
- Cozulemiyorsa console warning degil, QA sonucu ve belirgin placeholder uret.

C. Borsa giris yolunu ozel yol olarak modelle.
- x=795 dikey yolunu cakisma testinden tamamen cikarma.
- Bu yolu DRIVEWAY olarak isaretle.
- Borsa modelinin yalnizca tanimli entrance anchor noktasinda driveway'e yaklasmasina izin ver.
- Binanin govdesi yolun ustune gelemez.

D. Yol veya layout degistiginde cakisma kontrolunu yeniden calistir.
- fitClearOfRoads yalnizca modelSig degisince calismamali.
- Yol/layout revision degeri model cache signature icine girsin.
- Kamera veya gorsel olmayan state degisimlerinde gereksiz rebuild yapma.

E. Asset denetimi ekle.
Build oncesi calisabilecek bir script yaz:
- assets.ts FILES listesindeki her dosya gercekte var mi?
- .gltf icindeki buffer ve image URI'leri var mi?
- GLB/GLTF bounding box sifir veya NaN mi?
- Model boyutu parsel limitlerinin cok disinda mi?
- Yüklenemeyen asset adini ve tam yolunu raporla.
- npm script olarak "asset-audit" ekle.

F. Semantik bina-model eslemesi yap.
Genel model havuzundan rastgele bina secmek yerine acik mapping kullan:
- BANKA -> bank-realistic-v1 veya uygun bank modeli
- BORSA -> stock-exchange-realistic-v1
- MARKET -> market-realistic-v1
- FABRIKA -> factory-realistic-v1
- KAFE -> cafe-realistic-v1
- OYUNCU_OFISI -> office-realistic-v1
Gercek dosya adlari projedeki varliklara gore belirlenmeli. Olmayan dosya adlarini uydurma. Uygun hazir model yoksa mevcut procedural fallback'i kullan ve asset audit raporunda belirt.

G. Gorsel fallback ve hata kaydi.
- Bir model yuklenemezse sessizce yanlis modele gecme.
- Bina kimligi, istenen asset yolu ve loader hatasini raporla.
- Oyunda kirik goruntu yerine semantik procedural fallback goster.
- Texture/material paylasiminda dispose edilen ortak materyalin diger modelleri bozmamasini kontrol et.

H. Sehir QA testleri.
- Her bina footprint'i ile tum yollar arasinda minimum mesafe testi.
- Her bina allowed lot icinde mi?
- Bina-bina OBB cakismasi var mi?
- Tum asset yollari mevcut mu?
- Borsa driveway disinda yol ustune tasiyor mu?
- Model cache yenilendiginde ayni model iki kez dispose edilip bozuluyor mu?

KABUL KRITERLERI
- Yol ve bina konumlari tek veri kaynagindan gelmeli.
- Hicbir ana bina yolu veya kaldirimi kesmemeli.
- Borsa giris yolu korunurken bina govdesi yol ustune binmemeli.
- Eksik/bozuk asset audit sirasinda dosya adi ve yoluyla raporlanmali.
- Model bulunamazsa yanlis bina yerine tanimli fallback kullanilmali.

============================================================
4. UI KALABALIGI VE ILK OYUNCU DENEYIMI
============================================================

INCELENECEK ANA DOSYALAR
- src/components/game/TycoonGameView.tsx
- src/components/game/GameBottomNavigation.tsx
- src/components/game/FirstRunGuide.tsx
- src/components/game/GameTopBar.tsx
- Ilgili gameTypes ve onboarding state dosyalari

A. Asamali navigasyon kur.
Ilk 5 dakikada varsayilan olarak yalnizca:
- Sehir
- Borsa
- Rehber/Gorevler
aktif ve belirgin olsun.

Asamali acilis:
- Ilk hisse alindiginda Haberler aktif hale gelsin.
- FirstShopGate tamamlaninca Dukkan sekmesi aktif hale gelsin.
- Sirketlesme kosullarindan en az biri gorulunce Sirket sekmesi kilitli onizleme olarak gorunsun.
- Sirket kurulunca Sirket tam aktif olsun.
- Banka/kredi paneli ilk dukkan acildiktan veya gercek kredi ihtiyaci olustuktan sonra belirginlessin.
- Prestij, halka arz, holding, birlesme ve ileri finans araclari ilgili asamaya kadar gizli veya kilitli kalsin.

B. Kilitli sekme davranisi.
- Kilitli sekmede gri ikon + kilit simgesi kullan.
- Tiklandiginda bos veya karmasik panel acma.
- Kisa aciklama goster: "Ilk dukkanini acinca kullanilabilir" gibi.
- Ekran okuyucu icin disabled/aria-disabled durumunu dogru uygula.

C. Dukkan badge hatasini duzelt.
GameBottomNavigation icinde Dukkan sekmesinde portfolioPositionsCount kullanma.
- ownedShopCount kullan.
- Stogu biten dukkan sayisi varsa kirmizi badge goster.
- Tahsil edilebilir kar veya tamamlanan aksiyon varsa yesil dot kullan.
- Hisse pozisyon sayisi yalnizca Portfoy/Borsa baglaminda gosterilsin.

D. Rehberi metin modali olmaktan cikarip gorev tabanli yap.
Adimlar:
1. Borsa sekmesini vurgula.
2. Bir hisse kartini vurgula.
3. AL dugmesini vurgula.
4. Sektor bilgisini ve ikinci sektor filtresini goster.
5. Bir pozisyon icin SAT dugmesini vurgula.
6. FirstShopGate tamamlaninca Dukkan sekmesini vurgula.
7. Dukkan acilisinda isletme sermayesi uyarisini acikla.
8. Ilk stok siparisini ve ilk calisan islemini goster.

- Rehber hedef elementi bulunamazsa uygulama kilitlenmemeli; kullaniciya normal adim karti goster.
- Atla secenegi kalsin.
- Rehber sonradan Rehber butonundan tekrar baslatilabilsin.

E. Onboarding durumunu save-game'e tasi.
localStorage tek basina kaynak olmasin.
Onerilen veri:
onboarding: {
  version: 2,
  completedSteps: string[],
  dismissed: boolean,
  firstMarketUpdateSeen: boolean
}
- Eski kayitlarda bu alan yoksa migration uygula.
- Yeni kariyer ayni cihazda acilsa bile rehber tekrar calisabilsin.
- Mevcut localStorage anahtari yalnizca migration icin okunabilir, ana kaynak olmasin.

F. Rehber metinlerini gercek kurallarla uyumlu yap.
"Borsada para kazan, sonra dukkan ac" ifadesini kullanma; kar etmek zorunlu degil.
Daha dogru metin:
"Borsanin temel islemlerini tamamla: iki farkli sektorden hisse al, bir pozisyon sat ve ilk fiyat guncellemesini gor. Ardindan ilk dukkanini acabilirsin."

G. Ilk ekran bilgi yogunlugunu azalt.
Ilk asamada ust barda yalnizca:
- Nakit
- Net deger
- Oyun gunu/saat
belirgin olsun.
Su metrikleri ilgili panel acilana kadar ana ekranda gostermeme veya ikincil hale getirme:
- Kredi notu
- Borc/ozkaynak
- Politika faizi
- Ayrintili bilanço
- Calisan memnuniyeti
- Holding/halka arz metrikleri

H. Modal ve panel cakismalarini kontrol et.
- FirstRunGuide, OfflineProgressModal, bina bottom sheet, ayarlar ve bildirim cekmecesi ayni anda ust uste acilmasin.
- Tek bir modal/sheet koordinasyon katmani kullan.
- Rehber acikken oyun tercihen duraklatilsin veya ekonomik gun ilerlemesi durdurulsun.
- Mobil safe-area, 44 px minimum dokunma alani ve geri tusu davranisini test et.

UI KABUL KRITERLERI
- Yeni oyuncu ilk ekranda en fazla 3 ana navigasyon hedefi gormeli.
- Sirket sekmesi ilk dakikada bos ve aktif olmamali.
- Dukkan badge'i hisse pozisyon sayisini gostermemeli.
- Rehber gercek UI elementlerini sirayla vurgulamali.
- Yeni kariyer acildiginda onboarding kayda bagli olarak yeniden baslamali.
- Mobil ekranda ayni anda birden fazla modal acilmamali.

============================================================
5. TEST, OLCUM VE SON RAPOR
============================================================

UYGULAMA SONRASI CALISTIR
- npm run lint
- npm test
- npm run balans
- npm run kariyer
- npm run asset-audit
- npm run build

ILAVE QA SENARYOLARI
1. Sifir prestijli yeni kariyer ac.
2. Ilk borsa egitimini tamamla.
3. Ilk dukkani ac.
4. Isletme sermayesi uyarisini kontrol et.
5. Ilk calisani manuel ise al.
6. Ilk kucuk yukseltmeyi yap.
7. Ilk seviye yukseltmesini yap.
8. Isletme kredisi cekip hisse almaya calis; reddedilmeli.
9. Genel amacli krediyle alim yap; faiz ve masraf dogru olmali.
10. Ayni kredi vadesini tekrar tekrar isle; cift tahsilat veya yapay temerrut olmamali.
11. Urun fiyatini adil fiyatin 10 katina cikar; normal talep sifirlanmali.
12. Sehirde her binanin yol ve parsel cakisma raporunu kontrol et.
13. Bir asset yolunu test amacli boz; asset-audit kesin dosya yolunu raporlamali ve oyunda fallback gorunmeli.
14. 360 oyun gunu offline/otomatik ilerleme sonunda NaN, negatif borc, negatif stok veya sonsuz para olmamali.

SON CIKTI FORMATI
Calisma bittiginde su formatta rapor ver:

1. Degisen dosyalar
- Dosya yolu
- Yapilan degisiklik
- Degisikligin nedeni

2. Denge sonuclari
- Ilk dukkan: oyun gunu / gercek dakika
- Ilk kucuk yukseltme: oyun gunu / gercek dakika
- Ilk manuel calisan: oyun gunu / gercek dakika
- Ilk seviye yukseltmesi: oyun gunu / gercek dakika
- 30. dakikadaki nakit, net deger ve dukkan sayisi

3. Ekonomi testleri
- Kredi amortisman farki
- Exploit test sonuçlari
- Idempotency test sonuçlari
- Asiri fiyat testi

4. Sehir QA
- Yol-bina cakisma sayisi
- Parsel disina tasan bina sayisi
- Eksik asset sayisi
- Fallback kullanan bina listesi

5. UI/UX
- Baslangicta gorunen sekmeler
- Kilit acma kosullari
- Onboarding adimlari
- Mobil modal cakisma test sonucu

6. Komut sonuclari
- lint
- test
- balans
- kariyer
- asset-audit
- build

7. Kalan riskler
- Cozulmeyen veya tasarim karari gerektiren konular

ONEMLI
Yalnizca tavsiye listesi verme. Kod degisikliklerini gercekten uygula, testleri yaz, komutlari calistir ve gercek ciktilari raporla. Olmayan model, dosya, fonksiyon veya test sonucunu uydurma. Projede farkli isim kullaniliyorsa mevcut mimariye uygun gercek isimleri bul ve ona gore adapte et.
