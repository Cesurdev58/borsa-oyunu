3D SEHIRDEN INTERAKTIF TURKIYE HARITASINA GECIS
CLAUDE CODE UYGULAMA TALIMATI

ROL
Bu projeyi deneyimli bir TypeScript, React, oyun ekonomisi, mobil UX, harita arayuzu, save migration ve QA muhendisi olarak ele al. Amacin mevcut 3D sehir sistemini bir anda silmek degil; interaktif Turkiye haritasi ve sehir bazli magazacilik sistemini guvenli, test edilebilir ve kayitlarla geriye uyumlu bicimde kurmak, yeni sistem tamamen dogrulandiktan sonra eski 3D sistemi kaldirmaktir.

URUN KARARI
- Ana Sehir sekmesi, hareket ettirilebilir ve yakinlastirilabilir Turkiye haritasi olacak.
- Harita uzerinde sehir isimleri surekli gorunmeyecek.
- Sehir noktalarina dokununca sehir adi, avantajlar, dezavantajlar ve ekonomik bilgiler acilacak.
- Gri isaret, oyuncunun o sehirde magazasi olmadigini gosterecek. Gri, kilitli veya tiklanamaz anlamina gelmeyecek.
- Beyaz isaret, oyuncunun o sehirde en az bir magazasi oldugunu gosterecek.
- Sirket merkezinin bulundugu sehir beyaz ve altin cerceveli olacak.
- Sorunlu oyuncu sehri beyaz ve kirmizi uyari halkali olacak.
- Oyuncu komsu veya merkeze yakin sehirlerden ilerlemeye zorlanmayacak.
- Yeterli parasi varsa istedigi sehirde yatirim yapabilecek. Uzaklik ve sehir kosullari sadece maliyet, teslimat suresi, rekabet ve risk yaratacak.
- "Sehre Git" dugmesi, o sehirdeki magazalarin gosterildigi ayri sekmeyi acacak.
- Sehir magazalari ekraninin sol ustunde her zaman "Haritaya Don" dugmesi bulunacak.
- Haritaya donunce onceki kamera konumu, pan ve zoom korunacak.
- Yeni harita dogrulanmadan eski 3D kodlari ve assetleri silinmeyecek.

TEMEL UYGULAMA KURALLARI
1. Her fazi ayri commit veya ayri PR olarak uygula.
2. Bir fazin testleri gecmeden sonraki faza gecme.
3. Mevcut ekonomi, kredi, borsa, dukkan, prestij, basarim, kayit ve cevrimdisi ilerleme sistemlerini bozma.
4. Is kurallarini React bilesenlerine gommek yerine data/engine katmaninda tut.
5. Yeni denge sabitlerini merkezi dosyada tut. Projedeki uygun dosya gameBalance.ts veya yeni cityBalance.ts olabilir.
6. Olmayan kutuphane, dosya, model veya fonksiyon adini uydurma. Once mevcut yapida gercek isimleri bul.
7. Mevcut save dosyalari acilabilmeli. Save migration zorunludur.
8. Harita icin lisansi belirsiz bir asset kullanma. Projeye dahil edilen SVG/GeoJSON dosyasinin kaynagini ve lisansini kaydet.
9. 3D sistemi hemen kaldirma. Yeni sistem production-ready olduktan sonra temizle.
10. Yapilmayan manuel testi yapilmis gibi raporlama.

============================================================
FAZ 0 - MEVCUT MIMARI ENVANTERI VE GECIS PLANI
============================================================

AMAC
Kod yazmaya baslamadan once 3D sehir sisteminin oyuna nerelerden baglandigini ve yeni haritanin hangi durumlari devralacagini cikarmak.

INCELE
- src/components/game/TycoonGameView.tsx
- src/components/game/GameBottomNavigation.tsx
- src/components/game/city/**
- src/components/game/city3d/**
- src/engine/ShopOperations.ts
- src/engine/ShopSales.ts
- src/engine/DayCloseProcessor.ts
- src/engine/SimulationEngine.ts
- src/store/simulationStore.ts veya gercek store dosyasi
- src/models/trade.ts
- src/models/simulation.ts
- save serialization, migration ve backup dosyalari
- App.tsx ve route/modal koordinasyonu
- package.json ve mevcut test altyapisi

CIKARILACAK ENVANTER
1. Mevcut 3D sehir ekranina giris noktasi.
2. Bina seciminden acilan panel ve aksiyonlar.
3. Shop verisinin mevcut alanlari.
4. Shop acilis akisi ve maliyet hesabi.
5. Stok teslimati ve lojistik hesaplari.
6. Save modelinin surumu ve migration zinciri.
7. Offline progress'in shop satislarini nasil isledigi.
8. Mevcut 3D asset, Three.js ve loader bagimliliklari.
9. Harita ekranina tasinmasi gereken aktif olaylar ve uyarilar.
10. 3D kod temizliginde kaldirilabilecek dosyalar, ancak bu fazda silme yapma.

TESLIM
- ai-workflow/TURKIYE_HARITASI_GECIS_PLANI.md
- Dosya bagimlilik listesi
- Risk listesi
- Fazlara gore dosya degisiklik plani

KABUL KRITERI
- Hangi dosyanin neden degisecegi acik olmali.
- Save migration plani yazilmali.
- 3D sistem kaldirilmadan yeni ekranin paralel calistirilacagi belirtilmeli.

============================================================
FAZ 1 - SEHIR VERI MODELI VE MERKEZI TANIMLAR
============================================================

AMAC
Harita UI yazmadan once sehirleri ekonomi motorunun anlayacagi merkezi ve tip guvenli bir veri modeline donusturmek.

OLUSTURULACAK VEYA UYARLANACAK TIPLER

- CityId
- TurkeyRegion
- CityDefinition
- CityEconomicProfile
- CityMarkerState
- CityPresenceStatus
- CityCoordinates
- CityExpansionQuote

ONERILEN YAPI

interface CityDefinition {
  id: CityId;
  nameTR: string;
  region: TurkeyRegion;
  mapPosition: { x: number; y: number };

  demandMultiplier: number;
  rentMultiplier: number;
  wageMultiplier: number;
  logisticsMultiplier: number;
  competitionMultiplier: number;
  purchasingPowerMultiplier: number;

  sectorBonuses: Partial<Record<SectorId, number>>;
  shopBonuses: Partial<Record<ShopType, number>>;

  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  playStyleTR: string;
  advantagesTR: string[];
  disadvantagesTR: string[];
}

interface PlayerShop {
  // mevcut alanlar korunacak
  cityId: CityId;
}

interface GameState {
  // mevcut alanlar korunacak
  playerStartCityId?: CityId;
  selectedMapCityId?: CityId;
  headquartersCityId?: CityId;
  turkeyMapView?: {
    panX: number;
    panY: number;
    zoom: number;
  };
}

ILK SEHIR SETI
Ilk uygulamada 12 ayrintili şehir kullan:
- Istanbul
- Ankara
- Izmir
- Bursa
- Antalya
- Konya
- Gaziantep
- Mersin
- Samsun
- Kayseri
- Trabzon
- Diyarbakir

NOT
- Haritada 81 il noktasi kullanilacaksa kalan iller de tiklanabilir olmali.
- Ayrintili ekonomik profil hazir olmayan illere gecici olarak dengeli varsayilan profil uygulanabilir.
- Oyuncuya "gelecekte acilacak" gibi sahte kilit koyma.
- Ilk versiyonda teknik kapsam nedeniyle yalnizca 12 sehirde yatirim acilacaksa bunu urun karari olarak acikca raporla; ancak nihai hedef tum illerin serbest secimidir.

SEHIR DENGE PRENSIBI
- Hicbir sehir kesin en iyi olmamali.
- Ilk 10 saatlik otomatik simulasyonda en iyi ve en zayif baslangic sehri arasindaki net deger farki hedef olarak %20-35'i gecmemeli.
- Sehirler farkli oyun tarzi sunmali, dogru/yanlis cevap olmamali.

KABUL KRITERI
- Tum city tanimlari tek veri kaynagindan gelmeli.
- UI icinde ekonomik katsayi hard-code edilmemeli.
- TypeScript exhaustive check ile bilinmeyen CityId yakalanmali.
- Mevcut Shop nesnelerini bozmadan cityId eklenmeli.

============================================================
FAZ 2 - SAVE MIGRATION VE ESKI KAYIT UYUMLULUGU
============================================================

AMAC
Mevcut oyuncularin dukkanlari cityId alani olmadigi icin kaybolmasini veya oyunun crash olmasini engellemek.

MIGRATION KURALI
- Save version bir artirilsin.
- cityId bulunmayan her shop migration kuyruğuna girsin.
- Eski kayit ilk acildiginda bir defalik "Merkez Sehrini Sec" ekrani gosterilsin.
- Oyuncu sectigi zaman mevcut tum shoplar secilen sehre atanabilsin.
- Secim tamamlanmadan gun ilerlemesi ve offline progress baslatilmasin.
- Oyuncu ekranı kapatirsa veri kaybolmamali; secim bir sonraki acilista tekrar sorulmali.
- Fallback zorunluysa Ankara kullanilabilir, fakat oyuncuya secim sansi vermek tercih edilmeli.

MIGRATIONDA KORUNACAKLAR
- Shop ID
- Shop tipi ve seviyesi
- Stok
- Calisanlar
- Mudur
- Yukseltmeler
- Gelir/gider gecmisi
- Borclar ve krediler
- Kisitli bakiye
- Basarim ve kariyer ilerlemesi
- Prestij durumu
- Offline timestamp

TEST SENARYOLARI
1. Hic shop olmayan eski kayit.
2. Tek shop olan eski kayit.
3. Farkli seviyelerde birden fazla shop olan eski kayit.
4. Sirketi ve kredisi olan kayit.
5. Holding ve prestij yapmis kayit.
6. Eksik veya bilinmeyen cityId iceren bozuk kayit.
7. Export/import yapilmis eski save.
8. Backup'tan donen eski save.

KABUL KRITERI
- Eski kayit crash olmadan acilmali.
- Para, borc ve net deger sebepsiz degismemeli.
- Mevcut tum shoplar secilen sehre atanabilmeli.
- Migration ayni save icin iki kez calismamali.
- Migration oncesi otomatik yedek alinmali.

============================================================
FAZ 3 - HAREKET ETTIRILEBILIR TURKIYE HARITASI ALTYAPISI
============================================================

AMAC
3D sisteme dokunmadan yeni Turkiye haritasini ayri bir ekran olarak calistirmak.

TEKNIK TERCIH
- Dis ag istegi gerektirmeyen yerel SVG veya sade GeoJSON kullan.
- Google Maps, Mapbox veya gereksiz harita SDK'si ekleme.
- Harita noktalarinin tiklama koordinatlari veri modelindeki mapPosition alanindan gelsin.
- Programatik olarak karmasik gorsel uretme yerine lisansi uygun sade Turkiye harita asseti kullan.

HARITA ETKILESIMLERI
- Tek parmak veya mouse ile pan.
- Iki parmak pinch veya wheel ile zoom.
- Minimum zoom: Turkiye'nin tamami gorunur.
- Maksimum zoom: Yaklasik 3-6 sehir noktasi gorunur.
- Harita sinirlari disina sonsuz pan olmamali.
- Haritayi Ortala dugmesi.
- Magazalarima Git filtresi veya dugmesi.
- Bos alana dokununca secili sehir paneli kapanmali.
- Harita state'i ekran degistirirken korunmali.

SEHIR ISARETLERI
- Magaza yok: gri dolgu + koyu cerceve.
- Magaza var: beyaz dolgu + koyu lacivert cerceve + hafif golge.
- Sirket merkezi: beyaz dolgu + altin cerceve.
- Operasyon sorunu: beyaz dolgu + kirmizi uyari halkasi.
- Gecici firsat: ayri bir firsat halkasi veya kucuk rozet.
- Isaret minimum 44x44 px dokunma hedefi sunsun; gorsel nokta daha kucuk olabilir ancak hit area buyuk olmali.

COK ONEMLI
- Gri sehir pasif gorunmemeli.
- Gri sehir tiklanabilir olmali.
- disabled veya aria-disabled kullanma.
- Klavye ile odaklanabilmeli.
- Sehir isimleri haritada surekli gorunmemeli.
- Sehir adi yalnizca secim panelinde ve erisilebilir aria-label icinde bulunmali.

PERFORMANS
- Harita 60 FPS hedeflemeli.
- Her pan hareketinde tum oyun state'ini yeniden render etme.
- Marker hesaplarini memoize et.
- 81 il kullanilirsa DOM node sayisi kontrollu olmali.
- Mobil WebView'da Three.js'ye gore daha dusuk bellek ve CPU kullanimi hedefle.

KABUL KRITERI
- Pan ve zoom mobilde akici olmali.
- Sehir isaretleri dogru yerde kalmali.
- Harita yeniden acilinca pan/zoom state'i korunmali.
- Sehir adlari haritada kalici gorunmemeli.
- Gri ve beyaz marker anlamlari testlerle dogrulanmali.

============================================================
FAZ 4 - SEHIR BILGI PANELI
============================================================

AMAC
Sehre dokunuldugunda oyuncuya karar vermesi icin yeterli bilgi vermek, fakat haritayi kalabaliklastirmamak.

PANEL ICERIGI
- Sehir adi
- Ekonomik profil
- Zorluk seviyesi
- Oyun tarzi
- Ortalama kira seviyesi ve katsayisi
- Calisan maliyeti ve katsayisi
- Musteri potansiyeli
- Satin alma gucu
- Rekabet seviyesi
- Lojistik maliyeti
- Yerel sektor bonuslari
- Yerel shop bonuslari
- Avantajlar
- Dezavantajlar
- Oyuncunun o sehirdeki shop sayisi
- Toplam gunluk ciro
- Toplam gunluk net kar
- Tahmini yeni shop acilis maliyeti
- Ilk stok teslimat maliyeti ve tahmini teslimat suresi
- Varsa operasyon sorunu sayisi

BUTONLAR
Sehirde shop varsa:
- Sehre Git
- Yeni Magaza Ac
- Sehir Istatistikleri

Sehirde shop yoksa:
- Ilk Magazani Ac
- Maliyetleri Incele
- Pazar Arastirmasi, eger mekanik varsa

DAVRANIS
- Panel bottom sheet olarak acilabilir.
- Panel acikken arka harita pan'i tercihen durmali veya kontrollu kalmali.
- Surukleyerek kapatma ve kapat dugmesi olmali.
- Sehir degistirildiginde panel icerigi aninda guncellenmeli.
- Maliyetler gercek engine quote fonksiyonundan gelmeli; UI tahmin uydurmamali.

KABUL KRITERI
- Oyuncu bir sehre yatirim yapmadan once toplam ilk maliyeti gorebilmeli.
- Avantaj/dezavantajlar sayisal etkiye bagli olmali.
- Sehirde shop yokken bos Sehre Git ekrani acilmamali.
- Ekran okuyucu panel basligini ve butonlari dogru okumali.

============================================================
FAZ 5 - BASLANGIC SEHRI SECIMI
============================================================

AMAC
Yeni kariyerde oyuncunun istedigi sehirden baslamasini saglamak ve secimin sonucunu acikca gostermek.

AKIS
1. Yeni kariyer.
2. Oyuncu/holding adi ve varsa zorluk.
3. Turkiye haritasi.
4. Oyuncu istedigi sehre dokunur.
5. Sehir bilgi paneli acilir.
6. "Bu Sehirde Basla" dugmesi.
7. Risk ve maliyet ozetiyle onay.
8. Kariyer selected cityId ile baslar.

KURALLAR
- Merkez veya komsu sehir zorunlulugu yok.
- Ankara varsayilan onerilen sehir olabilir ama otomatik secilmemeli.
- Zor sehir seciminde net uyari ver.
- Oyuncu istedigi riskli sehri secebilir.
- Baslangic bonusu ve giderleri city definition'dan hesaplanmali.
- Ilk dukkan hedef suresi sehir farklarina ragmen makul kalmali.

SEHIR SECIM KARTINDA
- Zorluk: Kolay/Orta/Zor
- Oyun tarzi
- 2-4 avantaj
- 2-4 dezavantaj
- Tahmini ilk dukkan kurulum maliyeti
- Tahmini 7 gunluk isletme gideri
- Onerilen shop tipi
- "Bu Sehirde Basla"

DENGE TESTI
- Her baslangic sehri icin en az 10 seed ile ilk 10 saat simulasyonu.
- En iyi ve en zayif sehir net deger farki hedef %20-35.
- Ilk dukkan sureleri hedef banttan cok sapmamali.
- Cok pahali sehirde oyuncunun ilk yukseltmeden sonra nakdi sifira dusmemeli.

KABUL KRITERI
- Oyuncu tum oynanabilir sehirlerden istedigini secebilmeli.
- Sehir secimi save'e yazilmali.
- Ilk shop secilen sehirde acilmali.
- Secim geri tusuyla bozulmamali veya iki kez uygulanmamali.

============================================================
FAZ 6 - SEHRE GIT VE SEHIRDEKI MAGAZALAR SEKmesi
============================================================

AMAC
"Sehre Git" denildiginde, yalnizca secilen sehirdeki oyuncu isletmelerini gosteren ayri yonetim ekranini acmak.

NAVIGASYON
Turkiye Haritasi
-> Sehir Bilgi Paneli
-> Sehre Git
-> Sehir Magazalari
-> Magaza Yonetimi

GERI DONUS
Magaza Yonetimi
-> Sehir Magazalari
-> Turkiye Haritasi

SEHIR MAGAZALARI EKRANI
Ust bolum:
- Sehir adi
- Toplam shop sayisi
- Toplam gunluk ciro
- Toplam gunluk net kar
- Toplam calisan
- Stok sagligi
- Sehir itibari
- Varsa sehirdeki operasyon sorunlari

Ana bolum:
- Sadece selectedCityId ile eslesen shoplar.
- Magazalar, kafeler, marketler, galeriler, fabrikalar, depolar, ofisler ve merkezler kartlar halinde.
- Baska sehirdeki shoplar burada gorunmemeli.

SHOP KARTI
- Shop adi
- Shop tipi
- Gorsel bina resmi veya mevcut uygun 2D asset
- Seviye
- Gunluk ciro
- Gunluk net kar
- Stok yuzdesi
- Calisan durumu
- Mudur durumu
- Musteri memnuniyeti
- Aktif sorun

AKSIYONLAR
- Yonet
- Stok Siparis Et
- Yukselt
- Calisanlar
- Mudur
- Muhasebe

HARITAYA DON
- Sol ustte sabit "Haritaya Don" dugmesi.
- En az 44x44 px dokunma alani.
- Safe-area altinda kalmali.
- Tiklayinca Turkiye haritasina donmeli.
- Haritanin onceki pan, zoom ve secili sehir durumu korunmali.
- Android geri tusu da ayni navigasyon mantigini uygulamali.

ANDROID GERI TUSU SIRASI
1. Magaza detay paneli aciksa kapat.
2. Sehir magazalari ekranindaysa haritaya don.
3. Harita bilgi paneli aciksa paneli kapat.
4. Ana haritadaysa cikis onayi goster.

BOS DURUM
- Sehirde shop yoksa bu ekran normal akisla acilmamali.
- Deep-link veya bozuk state ile acilirsa "Bu sehirde henuz magazan yok" ve haritaya don aksiyonu goster.

KABUL KRITERI
- Sehre Git sadece o sehirde shop varsa aktif olmali.
- Shop filtrelemesi cityId ile yapilmali.
- Haritaya donuste kamera state'i kaybolmamali.
- Geri tusu ve buton ayni sonucu vermeli.

============================================================
FAZ 7 - SERBEST SEHIR GENISLEMESI VE ACILIS MALIYETI
============================================================

AMAC
Oyuncunun istedigi sehirde shop acmasina izin vermek, fakat uzaklik ve ekonomik kosullarin anlamli bedelini hesaplamak.

URUN KURALI
- Komssu sehir zorunlulugu yok.
- Bolge acma sirasi yok.
- Net degerle sehir kilidi yok.
- Yeterli kaynak varsa istenen sehre yatirim yapilabilir.
- Oyun oyuncuyu engellemez, maliyet ve riskleri gosterir.

QUOTE FONKSIYONU
Tek bir engine fonksiyonu asagidakileri hesaplasin:

interface CityExpansionQuote {
  cityId: CityId;
  shopType: ShopType;
  baseSetupCost: number;
  cityRentDeposit: number;
  regionalPermitCost: number;
  initialStockCost: number;
  initialLogisticsCost: number;
  prestigeDiscount: number;
  milestoneDiscount: number;
  totalUpfrontCost: number;
  recommendedReserve: number;
  estimatedDeliveryDays: number;
  warningsTR: string[];
}

MALIYET BILESENLERI
- Temel shop acilis maliyeti
- Sehir kira katsayisi
- Ruhsat/bolgesel giris maliyeti
- Ilk stok
- Mesafe ve lojistik
- Varsa prestij indirimi
- Varsa kilometre tasi indirimi
- 7 gunluk guvenlik rezervi

INDIRIM KURALI
- Ilk shopta prestij indirimi %20.
- Sonraki uygun shopta kilometre tasi indirimi %10.
- Iki indirim ayni shopta birlesmemeli.
- Kullanilmayan kilometre tasi indirimi korunmali.

UYARI
- Uzak sehir maliyeti yuksekse acikca goster.
- Onerilen rezerv altinda kalacaksa sari/kirmizi/kritik uyari ver.
- Engelleme yerine ikinci onay kullan; yalnizca gercekten yetersiz nakitte engelle.

KABUL KRITERI
- Ankara'dan Konya veya Istanbul'a acilis farkli maliyet uretmeli.
- Uzak sehir secimi yasaklanmamali.
- Quote ile gercek ledger tahsilati birebir uyusmali.
- Ayni islem iki kez cagrilsa cift shop veya cift tahsilat olusmamali.

============================================================
FAZ 8 - SEHIR EKONOMISINI SATIS, KIRA VE UCRETLERE BAGLAMA
============================================================

AMAC
Sehir secimini yalnizca gorsel degil, gercek ekonomik karar haline getirmek.

SATIS
finalDemand yaklasik su katmanlardan olussun:
- baseDemand
- city.demandMultiplier
- city purchasing power
- shop type bonus
- sector bonus
- season multiplier
- competition multiplier
- reputation
- price elasticity

GIDER
- rent = baseRent * city.rentMultiplier
- wage = baseWage * city.wageMultiplier
- logistics = baseLogistics * city.logisticsMultiplier * distance factor

KURALLAR
- Tum carpanlarda NaN, Infinity, negatif deger korumasi.
- Carpanlar tek yerde clamp edilmeli.
- Sehir bonuslari hem online hem offline progress'te ayni sonucu vermeli.
- DayCloseProcessor ve offline progress ayni ekonomi fonksiyonlarini kullanmali.
- UI hesaplamasi ile engine sonucu ayrismamali.

SEHIR KIMLIKLERI
Ornek oyun tarzi, kesin sayilar simulasyonla ayarlanacak:
- Istanbul: yuksek talep, yuksek kira/maas/rekabet.
- Ankara: dengeli, savunma ve teknoloji avantaji.
- Izmir: ticaret, turizm ve liman avantaji.
- Bursa: sanayi, otomotiv ve tekstil.
- Antalya: sezonluk yuksek turizm talebi.
- Gaziantep: dusuk maliyetli uretim ve ihracat.
- Konya: ucuz arazi, tarim ve makine.
- Mersin: liman, depo ve lojistik.
- Samsun: Karadeniz lojistik merkezi.
- Kayseri: uretim ve ticaret dengesi.
- Trabzon: bolgesel ticaret ve turizm.
- Diyarbakir: dusuk kurulum maliyeti, gelisen pazar.

DENGE TESTLERI
- 12 baslangic sehri x en az 10 seed x ilk 10 saat.
- Ayni shop tipinin sehirler arasi EBITDA farki.
- Oyuncunun zarar riski.
- Ilk yukseltme sonrasi nakit rezervi.
- Ikinci shop zamani.
- Ilk 1 milyon ve sirket kapisi zamani.

KABUL KRITERI
- Sehir secimi ekonomik olarak hissedilmeli.
- Hicbir sehir her shop ve sektorde en iyi olmamali.
- En guclu/zayif baslangic farki hedef bandi asarsa katsayilar yeniden ayarlanmali.

============================================================
FAZ 9 - LOJISTIK VE MESAFE SISTEMI
============================================================

AMAC
Oyuncuyu yakin sehre zorlamadan uzak yatirimin dogal lojistik sonucunu yaratmak.

ILK SURUM ICIN BASIT MODEL
- Ayni sehir: x1.00
- Ayni bolge: x1.10
- Komsu bolge: x1.25
- Uzak bolge: x1.50
- Liman avantaji: -%15
- O sehirde depo: -%20
- Otoyol/lojistik yukseltmesi varsa: -%10

NOT
Gercek kilometre matrisi varsa kullanilabilir, ancak ilk surumde 81x81 karmasik sistem zorunlu degil. Sonuclar deterministik ve aciklanabilir olmali.

TESLIMAT
- Stok aninda gelmek yerine estimatedDeliveryDays kullanabiliyorsa mevcut stok sistemiyle bagla.
- Mevcut oyun anlik stok kullaniyorsa once maliyet carpanini uygula; teslimat gecikmesini ayri faz/feature flag ile ekle.
- Offline progress bekleyen teslimatlari iki kez tamamlamamali.

DEPO
- Depo sadece gorsel bir shop degil, sehir/bölge lojistik maliyetini dusurmeli.
- Depo kapasitesi asilmamali.
- Depo bonusu ayni rota icin iki kez uygulanmamali.

KABUL KRITERI
- Uzak sehir secimi mumkun olmali.
- Uzak sehir daha pahali veya yavas olmali.
- Liman/depo avantaji hesapta ve UI aciklamasinda gorunmeli.
- Lojistik maliyeti ledger'da ayri izlenebilmeli.

============================================================
FAZ 10 - HARITA FILTRELERI, UYARILAR VE RAKIP GORUNUMU
============================================================

AMAC
Holding buyudukce haritanin okunabilirligini korumak.

FILTRELER
- Tum sehirler
- Magazalarim
- Fabrikalarim
- Depolarim
- Sirket merkezim
- Sorunlu isletmeler
- Ticaret firsatlari
- Lojistik hatlari
- Rakip hakimiyeti, gercek rakip verisi varsa

UYARI KURALLARI
Bir sehir isaretine kirmizi uyari halkasi ekle, eger:
- Stok kritik
- Calisan eksik
- Kredi/kira problemi
- Shop zarar ediyor
- Mudur gerekli
- Kapasite dolu

RAKIPLER
- Sahte sabit veri kullanma.
- Gercek RivalTycoon/NPC ekonomi verisi varsa pazar payi ve sehir varligi goster.
- Rakip sistemi yoksa dekoratif sahte hakimiyet katmani ekleme; sonraki faz olarak raporla.

KABUL KRITERI
- Filtre harita state'ini bozmaz.
- Sorunlu filtre gercek operasyon sorunlarindan hesaplanir.
- Sehir marker rengi ile uyari halkasi birbirini ezmez.

============================================================
FAZ 11 - YENI HARITAYI VARSAYILAN SEHIR EKRANI YAPMA
============================================================

AMAC
Yeni sistem yeterince test edildikten sonra Sehir sekmesini Turkiye haritasina yonlendirmek.

GECIS
- Feature flag kullan: turkeyMapEnabled.
- Ilk asamada gelistirme ortaminda ac.
- Save migration ve harita QA tamamlaninca varsayilan true yap.
- Eski 3D ekranı acil durum fallback olarak bir surum daha tutulabilir.
- Telemetry yoksa en azindan hata loglari ve fallback sayaci tut.

NAVIGASYON
- GameBottomNavigation Sehir sekmesi -> Turkiye haritasi.
- Eski city selection baglantilari yeni city selection state'ine uyarlansin.
- Baslangic onboarding, ilk sehir secimi ve ilk shop acilis adimlarini hedeflesin.
- Rehber halkasi harita noktasina ve panel butonuna dogru otursun.

KABUL KRITERI
- Yeni kariyer haritadan baslayabilmeli.
- Eski kariyer migration sonrasi haritaya girebilmeli.
- Sehir sekmesinde 3D ekran kendiliginden acilmamali.
- Geri tusu ve modal coordinator bozulmamali.

============================================================
FAZ 12 - 3D SISTEMIN GUVENLI KALDIRILMASI
============================================================

BU FAZA SADECE SU KOSULLARDA GEC
- Turkiye haritasi varsayilan ekran.
- Save migration testleri geciyor.
- Sehir shop ekrani tamam.
- Ekonomi ve lojistik baglantilari tamam.
- En az bir tam release testi yapildi.
- 3D fallback'e en az bir test turunda ihtiyac kalmadi.

KALDIRILACAKLARI ONCE ENVANTERDEN DOGRULA
- ThreeCityScene.ts ve iliskili city3d bilesenleri
- Kullanilmayan cityLayout bolumleri
- GLTF/GLB modeller
- Texture ve loader kodlari
- Three.js bagimliligi, baska yerde kullanilmiyorsa
- 3D asset audit'in artik gereksiz kisimlari

DIKKAT
- Shop kartlarinda kullanilan 2D bina gorsellerini silme.
- Three.js baska bir ekranda kullaniliyorsa paketi kaldirma.
- Asset lisans dosyalarini, kalan assetler kullaniyorsa koru.
- package.json ve package-lock.json birlikte guncellenmeli.
- Bundle boyutunu once/sonra olc.

KABUL KRITERI
- Uygulama build olmali.
- Kayip import olmamali.
- Bundle boyutu ve ilk acilis suresi raporlanmali.
- Eski save'ler calismali.
- Harita ve shop kartlari gorsel olarak eksiksiz olmali.

============================================================
FAZ 13 - OTOMATIK TEST PAKETI
============================================================

ASGARI TESTLER

VERI
1. Her CityId icin tek CityDefinition.
2. Map position sinirlar icinde.
3. Carpanlar gecerli ve sonlu.
4. Avantaj/dezavantaj metinleri bos degil.

MIGRATION
5. cityId olmayan shop migrate olur.
6. Migration para veya shop sayisini degistirmez.
7. Ayni migration iki kez uygulanmaz.
8. Backup migration oncesi alinir.

HARITA
9. Magaza olmayan sehir gri.
10. Magaza olan sehir beyaz.
11. Merkez altin cerceveli.
12. Sorunlu sehir kirmizi uyari halkali.
13. Gri sehir tiklanabilir.
14. Kalici sehir isimleri render edilmez.
15. Pan/zoom save ve restore edilir.

SEHIR EKRANI
16. Sehre Git yalnizca shop varsa aktif.
17. Secilen sehirdeki shoplar filtrelenir.
18. Baska sehir shoplari gorunmez.
19. Haritaya Don kamera state'ini korur.
20. Android geri akisi dogru state gecisleri uretir.

EKONOMI
21. Sehir talebi satisi etkiler.
22. Kira ve ucret katsayilari uygulanir.
23. Uzak sehir lojistik maliyeti daha yuksek.
24. Depo/liman indirimi bir kez uygulanir.
25. Online ve offline sonuclar ayni kurallari kullanir.
26. Quote ile ledger tahsilati uyusur.
27. Yetersiz nakitte shop acilmaz.
28. Ayni acilis iki kez cagrilsa tek shop olusur.

INDIRIM
29. Ilk shopta yalnizca prestij indirimi.
30. Kilometre tasi indirimi sonraki uygun shopa tasinir.
31. Iki indirim ayni shopta birlesmez.

DENGE
32. 12 sehir icin coklu seed kariyer testi.
33. En iyi ve zayif farki raporlanir.
34. Ilk shop/yukseltme/calisan sureleri hedef bantlarda kalir.

REGRESYON
35. Kredi, borsa, prestij, basarim ve save testleri gecmeye devam eder.
36. Cift faiz ve cevrimdisi cift tahsilat geri gelmez.

============================================================
FAZ 14 - MANUEL MOBIL QA
============================================================

CIHAZ MATRISI
- Android Chrome/WebView 360x800
- Android Chrome/WebView 412x915
- iPhone Safari 390x844
- Masaustu Chrome 1366x768
- Masaustu Safari 1440x900

KONTROL LISTESI
- Pan tek parmakla calisiyor.
- Pinch zoom sayfayi degil haritayi etkiliyor.
- Harita sinir disina kacmiyor.
- Gri ve beyaz marker net ayirt ediliyor.
- Isaretler en az 44 px dokunma alanina sahip.
- Sehir adlari yalnizca panelde gorunuyor.
- Bottom sheet safe-area ile cakismiyor.
- Sehre Git dogru shoplari aciyor.
- Haritaya Don sol ustte gorunuyor.
- Haritaya donunce zoom/pan korunuyor.
- Android geri tusu dogru sirada calisiyor.
- Shop kartlari tek sutunda tasmiyor.
- 2D bina gorselleri yukleniyor.
- Yeni shop acilis quote'u ekrana sigiyor.
- Ekran okuyucu sehir markerlarini sehir adi ve durumuyla okuyor.
- Dusuk cihazda harita kaydirma akici.

YAPILAMIYORSA
Manuel QA yapilamiyorsa basarili yazma. "Manuel cihaz testi bekliyor" olarak raporla.

============================================================
FAZ 15 - CALISTIRILACAK KOMUTLAR
============================================================

Her fazda uygun alt testleri calistir. Son entegrasyonda temiz kurulum yap:

rm -rf node_modules
npm ci
npm run lint
npm test
npm run build
npm run asset-audit
npm run balans
npm run kariyer
npm run prestij-sure

Yeni scriptler ekle:
- npm run city-audit
- npm run city-balance

city-audit sunlari raporlasin:
- Tanimli sehir sayisi
- Eksik map position
- Gecersiz carpan
- Tekrarlanan CityId
- Eksik avantaj/dezavantaj
- Harita siniri disindaki marker

city-balance sunlari raporlasin:
- Sehir bazinda ilk shop zamani
- Ilk yukseltme
- Ilk calisan
- Ikinci shop
- Ilk 1 milyon
- Sirket kapisi
- 10. saatte net deger
- Iflas orani
- En iyi/zayif sehir farki

============================================================
FAZ 16 - COMMIT VE PR PLANI
============================================================

TEK DEV PR YAPMA. ONERILEN SIRA:

PR 1: City domain modeli ve save migration
PR 2: Turkiye haritasi, markerlar ve sehir bilgi paneli
PR 3: Baslangic sehri ve Sehre Git/Haritaya Don akisi
PR 4: Serbest genisleme, quote, sehir ekonomisi ve lojistik
PR 5: Harita filtreleri, onboarding ve varsayilan Sehir sekmesi
PR 6: 3D sistemin ve kullanilmayan assetlerin kaldirilmasi

Her PR:
- Bir sonrakinin tabani olmali.
- Onceki PR dalindan acilmali veya kontrollu entegrasyon dalina alinmali.
- Birbirinden bagimsiz eski main dallari olusturma.
- Test ciktilarini PR aciklamasina eklemeli.

============================================================
SON RAPOR FORMATI
============================================================

Her faz sonunda:

1. Faz ve durum
- Tamamlandi / Kismi / Bloke

2. Degisen dosyalar
- Dosya yolu
- Yapilan degisiklik
- Neden

3. Davranis
- Kullanici ne gorecek?
- Ekonomi nasil degisecek?
- Eski kayit nasil korunacak?

4. Testler
- Calistirilan komut
- Test sayisi
- Sonuc

5. Denge sonuclari
- Sehir bazli kilometre taslari
- En iyi/zayif farki
- Iflas riski

6. Manuel QA
- Test edilen cihazlar
- Bulunan sorunlar
- Test edilemeyenler

7. Kalan riskler
- Sonraki faza devredenler

8. Sonraki faz
- Baslamadan once gereken kosullar

NIHAI KABUL KRITERLERI
- 3D sehir yerine Turkiye haritasi varsayilan Sehir ekrani.
- Haritada sehir isimleri surekli gorunmez.
- Gri sehir magazasiz ama tiklanabilir.
- Beyaz sehir oyuncunun magazasi olan sehirdir.
- Oyuncu istedigi sehirde yatirim yapabilir; komsuluk kilidi yoktur.
- Sehir bilgileri secim panelinde acik ve sayisaldir.
- Sehre Git sadece o sehirdeki shoplari gosterir.
- Sol ust Haritaya Don dugmesi calisir ve kamera state'ini korur.
- Sehir ekonomisi satis, kira, ucret ve lojistigi etkiler.
- Eski save'ler migration ile korunur.
- Mobil pan/zoom ve geri tusu calisir.
- Yeni harita tamamen dogrulanmadan eski 3D kod silinmez.
- 3D kaldirildiktan sonra build, test ve bundle raporu temizdir.

SON KURAL
Bu talimati yalnizca analiz edip tavsiye verme. Faz 0'dan basla, gercek dosyalari incele, plani olustur, sonra her fazi kontrollu bicimde uygula. Her fazda gercek test ciktilarini raporla. Bir sonraki faza gecmek icin once mevcut fazin kabul kriterlerini sagla. Kullanici tarafindan istenmeyen komsuluk veya sehir kilidi ekleme.
