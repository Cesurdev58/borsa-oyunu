# Türkiye harita çizimi — kaynak ve lisans

- **Veri:** Natural Earth 1:10m ülke sınırları (kamu malı / public domain, https://www.naturalearthdata.com/about/terms-of-use/).
- **Paket:** `world-atlas` 2.0.2 (ISC lisansı, Mike Bostock) içindeki `countries-10m.json`; yalnızca geliştirme sırasında indirildi.
- **Üretim:** `npx tsx scripts/build-turkey-map.ts <countries-10m.json>` → `src/data/turkeyMapGeometry.ts`
  (sadeleştirilmiş SVG yolu; şehir noktalarıyla aynı izdüşüm: `projectToMapPrecise`).
- **Çalışma zamanında ağ isteği yoktur;** çizim kodun içine gömülüdür. Harita SDK'sı (Google/Mapbox vb.) kullanılmaz.
- Not: Natural Earth sınırları tarafsız bir veri kümesidir; oyun içinde siyasi iddia taşımaz, yalnızca görsel zemindir.
