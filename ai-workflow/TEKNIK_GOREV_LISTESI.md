TURKIYE HARITASI DONUSUMU
TEKNIK GOREV LISTESI

KAYNAK DURUM
- PR5: Harita aktivasyonu ve Faz 10-11 tamamlandi.
- PR6: 3D temizligi, regresyon testleri ve Faz 12-13-15 tamamlandi.
- Dallar birbirinin uzerinde: main <- PR1 <- PR2 <- PR3 <- PR4 <- PR5 <- PR6.
- Dallar GitHub'a gonderildi ancak Pull Request'ler acilmadi.
- Son test tabani: 359/359 test basarili.
- Mevcut durum entegrasyon ve mobil QA icin hazir, production icin henuz hazir degil.

ONCELIK SEVIYELERI
- P0: Merge veya yayin oncesi zorunlu.
- P1: Ilk production surumu oncesi tamamlanmali.
- P2: Sonraki kucuk surumde tamamlanabilir.
- P3: Ileri gelistirme veya icerik genisletmesi.

TAMAMLANMA KURALI
Bir gorev ancak kod, otomatik test, gerekiyorsa manuel QA ve gercek komut ciktilari tamamlandiginda kapatilabilir. Yapilmayan cihaz testi basarili sayilmayacak.

============================================================
EPIC 1 - PR1-PR6 ENTEGRASYONU
ONCELIK: P0
============================================================

GOREV 1.1 - Tek entegrasyon dali olustur
- PR6 dali butun onceki commitleri iceriyorsa PR6 tabanindan integration/turkey-map-complete dali olustur.
- PR1-PR6 commit gecmisinin eksiksiz oldugunu git log --graph ile dogrula.
- Eski main tabanindan bagimsiz yeni dallar olusturma.

Kabul kriterleri:
- Entegrasyon dali PR1-PR6 degisikliklerinin tamamini icerir.
- Eksik commit veya tekrar cherry-pick edilen commit yoktur.
- Cozulmemis merge isareti bulunmaz: <<<<<<<, =======, >>>>>>>.

GOREV 1.2 - Tek entegrasyon Pull Request'i ac
- Base: main.
- Compare: integration/turkey-map-complete veya PR6'nin nihai dali.
- PR basliginda 3D sehirden Turkiye haritasina gecis oldugu acikca yazilsin.
- PR aciklamasinda PR1-PR6 kapsamlarini bolum bolum listele.
- Mevcut test, build, city-audit ve city-balance sonuclarini ekle.
- Bilinen eksikleri acikca yaz: mobil QA, depo ekrani, eksik uyarilar, sektor bonuslari, canli/hizli sim farki.

Kabul kriterleri:
- PR aciklamasi degisen sistemleri ve bilinen riskleri icerir.
- PR1-PR6 ayri ayri main'e merge edilmez.
- Entegrasyon PR'i kapanmadan eski dallar silinmez.

GOREV 1.3 - Temiz kurulum yap
Calistir:
- rm -rf node_modules
- npm ci

Kabul kriterleri:
- npm ci gercekten tamamlanir.
- npm ci --dry-run tek basina yeterli sayilmaz.
- package.json ve package-lock.json uyumludur.
- three ve @types/three temiz kurulumda kurulmaz.

GOREV 1.4 - Birlesik komut setini calistir
Calistir:
- npm run lint
- npm test
- npm run build
- npm run city-audit
- npm run city-balance
- npm run balans
- npm run kariyer
- npm run prestij-sure

Kabul kriterleri:
- Test sayisi en az 359 ve tum testler basarili.
- TypeScript/lint hatasi yok.
- Vite production build basarili.
- city-audit kritik hata raporlamiyor.
- city-balance en iyi/en zayif sehir farkini %20-35 bandinda tutuyor.
- balans, kariyer ve prestij-sure NaN, Infinity, negatif stok veya beklenmeyen iflas uretmiyor.
- Gercek komut ciktilari PR aciklamasina ekleniyor.

GOREV 1.5 - Main sonrasi dogrulama
- Entegrasyon PR'i merge edildikten sonra main dalini temiz cek.
- npm ci ve zorunlu komutlari main uzerinde tekrar calistir.
- GitHub Actions sonucunu kontrol et.

Kabul kriterleri:
- Main ile entegrasyon dali arasinda beklenmeyen fark yok.
- CI basarili.
- PR1-PR6, entegrasyon PR'i tarafindan kapsandigi notuyla kapatilir veya arsivlenir.

============================================================
EPIC 2 - GERCEK MOBIL VE TARAYICI QA
ONCELIK: P0
============================================================

GOREV 2.1 - Android 360x800 testi
Kontrol et:
- Tek parmak pan.
- Pinch zoom.
- Sayfa yerine haritanin hareket etmesi.
- Sehir marker dokunma alani en az 44x44 px.
- Sehir bilgi paneli.
- Sehre Git.
- Haritaya Don.
- Android geri tusu.
- Rehber halkasi.
- "Yine de ac" ikinci onayi.

Kabul kriterleri:
- Yatay sayfa kaymasi yok.
- Harita sinir disina kaybolmuyor.
- Gri ve beyaz markerlar ayirt ediliyor.
- Android geri tusu sirasiyla detay panelini, sehir ekranini ve bilgi panelini kapatiyor.
- Haritaya donuste pan, zoom, filtre ve secili sehir korunuyor.

GOREV 2.2 - Android 412x915 testi
- Gorev 2.1 senaryolarini tekrarla.
- Uzun sehir avantaji/dezavantaji panelini kontrol et.
- Magaza karti aksiyonlarinin ekrana sigdigini dogrula.

GOREV 2.3 - iPhone Safari 390x844 testi
Kontrol et:
- Safe-area inset.
- Bottom sheet ve ust butonlar.
- Pinch zoom ile Safari sayfa zoom'unun cakismamasi.
- Dosya disa aktarma/ice aktarma.
- Haritaya Don dugmesinin centik altinda kalmamasi.

GOREV 2.4 - Masaustu testi
Cihazlar:
- Chrome 1366x768.
- Safari 1440x900.

Kontrol et:
- Mouse drag.
- Wheel zoom.
- Klavye focus.
- Enter/Space ile sehir marker secimi.
- Escape ile panel kapatma.
- Responsive gecisler.

GOREV 2.5 - Mobil QA raporu
Raporla:
- Cihaz ve tarayici surumu.
- Test edilen ekran boyutu.
- Gecen senaryolar.
- Bulunan hatalar.
- Ekran goruntuleri veya video kaniti.
- Test edilemeyen senaryolar.

Kabul kriterleri:
- Gercek telefon veya Android/iOS emulasyonu kullanilir.
- Masaustu Chrome'u 390x844 boyutuna getirmek gercek mobil test yerine gecmez.
- Kritik P0/P1 mobil hata kalmaz.

============================================================
EPIC 3 - EKSIK SEHIR OPERASYON UYARILARI
ONCELIK: P1
============================================================

GOREV 3.1 - Kredi/kira problemi uyarisi
Uyari kosullari:
- Vadesi gecmis kredi taksiti varsa.
- Vadesi gecmis kira varsa.
- Mevcut serbest nakit bir sonraki zorunlu kira veya kredi odemesini karsilamiyorsa.
- Onerilen erken risk: onumuzdeki 3 gunluk zorunlu giderler karsilanamiyorsa.

Kabul kriterleri:
- Haritada sehir markerina kirmizi uyari halkasi eklenir.
- Sehir magazalari kartinda sorun nedeni metin olarak gosterilir.
- Ayni sorun birden fazla shopta varsa sehir ozetinde adet gosterilebilir.
- Kredi faizi veya taksit iki kez hesaplanmaz.

GOREV 3.2 - Mudur gerekli uyarisi
Uyari kosullari:
- Shop seviyesi veya is yukune gore mudur gereksinimi acilmissa.
- Mudur olmadigi icin verim cezasi uygulanmaya baslamissa.
- Oyuncunun manuel yonetim kapasitesi asilmissa.

Kabul kriterleri:
- Her yeni shop mudur gerekli diye isaretlenmez.
- Uyari yalnizca gercek oyun kuralindan hesaplanir.
- Mudur ataninca uyari ayni state guncellemesinde kalkar.

GOREV 3.3 - Kapasite dolu uyarisi
Uyari kosullari:
- Son 3 oyun gununde talep, satis kapasitesini asmissa.
- Stok mevcut oldugu halde kapasite nedeniyle satis kaybi olusuyorsa.
- Raf/musteri/uretim kapasitesi en az %95 kullanimdaysa.

Kabul kriterleri:
- Stok yoklugu ile kapasite sorunu birbirine karistirilmaz.
- Uyari shop kartinda gercek kapasite oranini gosterir.
- Yukseltme sonrasi kapasite normale donerse uyari kalkar.

GOREV 3.4 - Uyari testleri
Ekle:
- Kredi/kira risk testi.
- Mudur gerekli testi.
- Kapasite dolu testi.
- Birden fazla sorun ayni sehirde testi.
- Sorun cozulunce marker guncelleme testi.

============================================================
EPIC 4 - DEPO KURMA VE YONETIM EKRANI
ONCELIK: P1
============================================================

GOREV 4.1 - Sehir paneline Depo Kur aksiyonu ekle
Goster:
- Kurulum maliyeti.
- Gunluk bakim gideri.
- Baslangic kapasitesi.
- Lojistik indirim orani.
- Etki alani.
- Yatirim sonrasi kalan serbest nakit.

Kabul kriterleri:
- Oyuncu yeterli nakdi varsa istedigi sehirde depo kurabilir.
- Komssu sehir veya bolge kilidi yoktur.
- Yetersiz nakitte islem engellenir.
- Guvenlik rezervi altinda ikinci onay gosterilir.

GOREV 4.2 - Depo veri modelini tamamla
Alanlar:
- id.
- cityId.
- level.
- capacity.
- usedCapacity.
- maintenanceCost.
- logisticsDiscount.
- servedShopIds veya etki kurali.

Kabul kriterleri:
- Sehir verisi olmayan eski depolar migration ile merkez sehre atanir.
- Depo save export/import ve backup sisteminde korunur.
- Ayni sehirde birden fazla depo kurali acik ve testlidir.

GOREV 4.3 - Depo karti ve yonetim ekrani
Goster:
- Doluluk.
- Toplam kapasite.
- Beslenen magazalar.
- Saglanan lojistik tasarrufu.
- Bakim gideri.
- Yukseltme maliyeti.

GOREV 4.4 - Depo ekonomi entegrasyonu
Ilk surum:
- Ayni sehirde lojistik maliyeti -%20.
- Ayni rota icin indirim yalnizca bir kez.
- Liman, depo ve diger indirimler acik sirayla uygulanir.

Kabul kriterleri:
- Quote ile ledger tahsilati uyusur.
- Online ve offline ilerleme ayni depo kuralini kullanir.
- Depo silinirse veya kapasitesi dolarsa indirim yanlis uygulanmaz.

GOREV 4.5 - Depo testleri
Ekle:
- Kurulum.
- Yetersiz nakit.
- Lojistik indirimi.
- Indirimin iki kez uygulanmamasi.
- Save migration.
- Offline progress.
- UI filtre sayisi.

============================================================
EPIC 5 - SEHIR BONUSLARINI TUM SEKTORLERE BAGLAMA
ONCELIK: P1
============================================================

GOREV 5.1 - Mevcut yedi eksik sektorun envanteri
- Perakende disinda baglanmamis sektorleri listele.
- Her sektor icin sehir bonusunun hangi ekonomik kaleme uygulanacagini belirle.
- Dogrudan genel kar carpani kullanmaktan kacin.

GOREV 5.2 - Sektor etkilerini tanimla
Ornek etkiler:
- Ankara: savunma ihale sansi, teknoloji Ar-Ge maliyeti.
- Bursa: otomotiv/tekstil uretim maliyeti ve kapasite gelistirme.
- Mersin: lojistik ve ithalat maliyeti.
- Gaziantep: tekstil/gida uretim maliyeti ve ihracat sozlesmesi.
- Konya: tarim/makine kapasitesi.
- Izmir: ticaret ve turizm talebi.
- Antalya: sezonluk turizm talebi.

Kabul kriterleri:
- Her bonusun sayisal etkisi merkezi CityDefinition veya cityBalance verisinden gelir.
- React UI icinde hard-code edilmez.
- UI aciklamasi gercek formulle uyusur.
- Ayni bonus iki farkli engine adiminda tekrar uygulanmaz.

GOREV 5.3 - Sirket ve holding ekonomisine bagla
Kontrol et:
- Uretim maliyeti.
- Ar-Ge gideri.
- Ihale sansi.
- Kapasite maliyeti.
- Lojistik gideri.
- Sozlesme sikligi.
- Calisan verimliligi.

Kabul kriterleri:
- Sehir bonuslari sadece dukkan doneminde degil, sirket ve holding doneminde de anlamlidir.
- Bir sehir her sektorde en iyi hale gelmez.
- Sektor secimi ile sehir secimi arasinda stratejik ama adil fark vardir.

GOREV 5.4 - Sektor-sehir denge simulasyonu
Calistir:
- 12 sehir x tum sektorler x en az 10 seed.
- 10 saat, sirket kapisi ve prestij kilometre taslarini raporla.

Kabul kriterleri:
- En guclu kombinasyon tek zorunlu meta haline gelmez.
- En zayif kombinasyon odulsuz/yasanamaz yol olmaz.
- Guc farki raporlanir ve hedef disindaysa katsayilar ayarlanir.

============================================================
EPIC 6 - CANLI VE HIZLI ILERLEME ESITLIGI
ONCELIK: P1
============================================================

GOREV 6.1 - Fark kaynagini tespit et
Ozellikle manav ve market icin incele:
- Saatlik ve gunluk toplu satis hesaplari.
- Random seed tuketim sirasi.
- Yuvarlama sirasi.
- Fiyat guncellemesi.
- Stok dusumu.
- Musteri sayisi.
- Gun kapanisi sirasi.

GOREV 6.2 - Ortak simulasyon fonksiyonu kullan
- Canli ilerleme ve hizli/offline ilerleme ayni saf ekonomi fonksiyonlarini cagirsin.
- Fark yalniz zaman adimlama veya izin verilen deterministik yaklasimdan gelsin.
- UI tarafinda ayri ekonomi hesabı yapma.

GOREV 6.3 - Deterministik regresyon testi
Senaryo:
- Ayni baslangic state'i.
- Ayni random seed.
- Ayni fiyat ve stok.
- 30 oyun gunu.
- Bir kosu canli/saatlik adimlarla.
- Bir kosu hizli/gunluk adimlarla.

Hedefler:
- Net kar farki %1'den dusuk.
- Stok farki %1-2'den dusuk.
- Musteri sayisi farki %1-2'den dusuk.
- Kredi, kira ve ucretler birebir ayni.

Kabul kriterleri:
- Mevcut %2-10 fark hedef bandina iner.
- Duzeltme baska shop tiplerinin dengesini bozmaz.
- Offline progress ikinci kez islenince cift gelir veya cift faiz olusmaz.

============================================================
EPIC 7 - MERSIN VE LIMAN AVANTAJININ GORUNURLUGU
ONCELIK: P2
============================================================

GOREV 7.1 - Tek dukkanli oyunda kucuk liman avantaji
Onerilen test araligi:
- Ilk stok sevkiyati -%10.
- Ithal urun tedarik maliyeti -%8.
- Depo kurulum maliyeti -%10.

Kural:
- Kesin oranlari city-balance ile olc.
- Mersin'i her shop turunde en iyi sehir yapma.
- Ana guclu avantaj ikinci sehir, depo ve ithalat acilinca ortaya ciksin.

GOREV 7.2 - UI aciklamasi
- Aktif bonusu sayisal olarak goster.
- Henuz acilmayan lojistik avantajina "Depo/ithalat acildiginda" aciklamasi ekle.
- Calismayan bonusu aktifmis gibi gosterme.

============================================================
EPIC 8 - 2D ASSET DENETIMI
ONCELIK: P2
============================================================

GOREV 8.1 - city-audit'i genislet veya ui-asset-audit ekle
Dogrula:
- Turkiye harita SVG/GeoJSON dosyasi.
- public/buildings/*.png.
- buildingSprites.ts referanslari.
- Sehir marker ikonlari.
- Basarim ikonlari.
- Eksik yol.
- Sifir baytli dosya.
- Desteklenmeyen format.

Kabul kriterleri:
- Eski 3D asset kontrolleri geri getirilmez.
- Kalan 2D asset yollarinin tamami build oncesi dogrulanir.
- Eksik dosya tam yoluyla raporlanir.

============================================================
EPIC 9 - HARITA GERI BILDIRIMLERI
ONCELIK: P2
============================================================

GOREV 9.1 - Harita bildirim rozeti
3D para/raf baloncuklarini geri getirme. Bunun yerine sehir markerinda kucuk rozet kullan:
- Kritik stok.
- Bekleyen karar.
- Tamamlanan yukseltme.
- Tahsil edilebilir gorev odulu.

Kabul kriterleri:
- Harita kalabaliklasmaz.
- Rozet gercek sayiyi veya oncelikli tek durumu gosterir.
- Ayni olay iki kez odul vermez.
- Magaza kartindaki aksiyonlarla tutarlidir.

============================================================
EPIC 10 - RELEASE KAPISI
ONCELIK: P0
============================================================

GOREV 10.1 - Son regresyon paketi
Calistir:
- npm ci
- npm run lint
- npm test
- npm run build
- npm run city-audit
- npm run city-balance
- npm run balans
- npm run kariyer
- npm run prestij-sure

Kabul kriterleri:
- Tum testler basarili.
- Test sayisi onceki taban olan 359'dan dusmez; yeni testlerle artmasi beklenir.
- Build basarili.
- Sehir farki %20-35 hedef bandinda.
- Iflas riski beklenmedik sekilde artmaz.
- Kariyer hizi kabul bantlarinda kalir.

GOREV 10.2 - Paket boyutu kontrolu
Referans:
- Onceki dist: 9,8 MB.
- 3D sonrasi dist: 3,5 MB.
- Onceki public: 7,4 MB.
- 3D sonrasi public: 1,8 MB.

Kabul kriterleri:
- Yeni 2D harita ve UI assetleri bundle boyutunu gereksiz buyutmez.
- Buyume varsa dosya bazinda aciklanir.
- Three.js veya 3D model klasoru geri gelmez.

GOREV 10.3 - Production hazirlik karari
Durumlardan birini sec:
- MERGE HAZIR.
- KOSULLU MERGE HAZIR.
- MERGE EDILMEMELI.

Karar kanitlari:
- Otomatik test sonucu.
- Mobil QA sonucu.
- Acik P0/P1 hata sayisi.
- Save migration sonucu.
- Build ve city-balance sonucu.

============================================================
ONERILEN PR PLANI
============================================================

PR-A: PR1-PR6 tam entegrasyonu ve temiz kurulum kaniti.
PR-B: Mobil QA hotfixleri ve eksik operasyon uyarilari.
PR-C: Depo kurma/yönetim ekrani.
PR-D: Yedi sektorun sehir bonusu entegrasyonu.
PR-E: Canli/hizli simulasyon esitligi.
PR-F: Mersin bonusu, 2D asset audit ve harita rozetleri.

KURAL
- PR'lar bir onceki onayli entegrasyon dalinin ustune kurulabilir.
- Birbirinden kopuk eski main dallari olusturma.
- Her PR aciklamasina test ciktilari, bilinen riskler ve migration etkisi ekle.

============================================================
SON RAPOR FORMATI
============================================================

1. Tamamlanan epic ve gorevler
- Gorev ID.
- Dosyalar.
- Davranis degisikligi.

2. Komut sonuclari
- npm ci.
- lint.
- test ve test sayisi.
- build.
- city-audit.
- city-balance.
- balans.
- kariyer.
- prestij-sure.

3. Mobil QA
- Cihaz.
- Tarayici.
- Ekran boyutu.
- Sonuc.
- Bulunan hata.

4. Denge
- En guclu/zayif sehir farki.
- Iflas orani.
- Ikinci dukkan.
- Ilk 1 milyon.
- Sirket kapisi.
- Prestij sureleri.

5. Acik sorunlar
- P0/P1/P2/P3 olarak siniflandir.
- Her sorun icin sahip, dal/PR ve sonraki adim.

6. Nihai karar
- Merge hazir / kosullu / hazir degil.

SON KURAL
Yeni ozellik eklemeye baslamadan once Epic 1 ve Epic 2'yi tamamla. PR entegrasyonu ve gercek mobil QA kapanmadan production hazir deme. Yapilmayan testi yapilmis gibi raporlama.
