# Türkiye harita çizimi — kaynak ve lisans

## 81 il sınırları (il poligonları)

- **Veri:** Natural Earth 1:10m "Admin 1 – States, Provinces" (`ne_10m_admin_1_states_provinces`), Türkiye'nin 81 ili.
  **Kamu malı / public domain** — https://www.naturalearthdata.com/about/terms-of-use/ (atıf gerekmez; yine de kaynak burada kayıtlıdır).
- **Alındığı yer:** GeoJSON sürümü, https://github.com/nvkelso/natural-earth-vector (`geojson/ne_10m_admin_1_states_provinces.geojson`);
  yalnızca geliştirme sırasında indirildi (depoya eklenmedi, ~40 MB).
- **Üretim:** `npx tsx scripts/build-turkey-provinces.ts <geojson>` → `src/data/turkeyProvinceGeometry.ts`.
  Poligonlar elle çizilmedi: yalnızca izdüşüm (`projectToMapPrecise`, şehir noktalarıyla aynı) ve Douglas–Peucker sadeleştirme (0,12 birim) uygulandı.
- **İl eşleştirme:** Natural Earth `iso_3166_2` ("TR-06") → plaka kodu → `CITY_DEFINITIONS[…].plateCode` → `CityId`. Eşleşmeyen/eksik il varsa script hata verir; test (`turkeyMap.test.ts`) 81 ilin varlığını, sahne içinde olduğunu ve il merkezinin kendi poligonunda kaldığını denetler.

## Komşu ülkeler zemini

- Natural Earth 1:10m ülke sınırları (kamu malı); `world-atlas` 2.0.2 (ISC, Mike Bostock) içindeki `countries-10m.json`.
  `npx tsx scripts/build-turkey-map.ts <countries-10m.json>` → `src/data/turkeyMapGeometry.ts` (`TURKEY_NEIGHBORS_PATH`). Eski tek parça Türkiye silüeti (`TURKEY_OUTLINE_PATH`) kaldırıldı; Türkiye yalnızca 81 il poligonuyla çizilir.

## Genel

- **Çalışma zamanında ağ isteği yoktur;** çizim kodun içine gömülüdür. Harita SDK'sı (Google/Mapbox vb.) kullanılmaz.
- Not: Natural Earth sınırları tarafsız bir veri kümesidir; oyun içinde siyasi iddia taşımaz, yalnızca görsel zemindir. Natural Earth'te bazı il adları ASCII/eksik yazılmıştır (ör. "K. Maras", "Kinkkale"); oyun kendi il adlarını `cityDefinitions.ts`'ten okur, bu adlar kullanılmaz.
