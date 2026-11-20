import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CITY_COUNT,
  CITY_DEFINITIONS,
  CITY_IDS,
  DETAILED_CITY_IDS,
  MAP_HEIGHT,
  clampCityBonus,
  clampCityMultiplier,
  getAllCityDefinitions,
  getCityDefinition,
  getDetailedCityDefinitions,
  isCityId,
} from '../../data/cityDefinitions';
import {
  CITY_BONUS_MAX,
  CITY_BONUS_MIN,
  CITY_MULTIPLIER_MAX,
  CITY_MULTIPLIER_MIN,
  DEFAULT_CITY_PROFILE,
  DETAILED_CITY_COUNT,
  MAP_WIDTH,
} from '../../data/cityBalance';
import type { CityDefinition, TurkeyRegion } from '../../models/cities';

const MULTIPLIER_KEYS = [
  'demandMultiplier',
  'rentMultiplier',
  'wageMultiplier',
  'logisticsMultiplier',
  'competitionMultiplier',
  'purchasingPowerMultiplier',
] as const;

test('Şehir verisi: 81 il, her kimlik için tek tanım, plaka kodları 1–81 eksiksiz', () => {
  assert.equal(CITY_COUNT, 81);
  assert.equal(new Set(CITY_IDS).size, 81, 'Tekrarlanan CityId olmamalı');
  const defs = getAllCityDefinitions();
  assert.equal(defs.length, 81);
  for (const id of CITY_IDS) {
    const def = getCityDefinition(id);
    assert.equal(def.id, id, `${id} tanımının kimliği anahtarla aynı olmalı`);
    assert.equal(CITY_DEFINITIONS[id], def);
  }
  const plates = defs.map((d) => d.plateCode).sort((a, b) => a - b);
  assert.deepEqual(plates, Array.from({ length: 81 }, (_, i) => i + 1));
  assert.equal(CITY_IDS[0], 'adana');
  assert.equal(CITY_IDS[80], 'duzce');
  assert.equal(getCityDefinition('istanbul').plateCode, 34);
});

test('Şehir verisi: 7 coğrafi bölgedeki il sayıları resmî dağılımla aynı', () => {
  const counts: Record<TurkeyRegion, number> = {
    MARMARA: 0,
    EGE: 0,
    AKDENIZ: 0,
    IC_ANADOLU: 0,
    KARADENIZ: 0,
    DOGU_ANADOLU: 0,
    GUNEYDOGU_ANADOLU: 0,
  };
  for (const d of getAllCityDefinitions()) counts[d.region] += 1;
  assert.deepEqual(counts, {
    MARMARA: 11,
    EGE: 8,
    AKDENIZ: 8,
    IC_ANADOLU: 13,
    KARADENIZ: 18,
    DOGU_ANADOLU: 14,
    GUNEYDOGU_ANADOLU: 9,
  });
});

test('Şehir verisi: harita konumları sahne sınırları içinde ve birbirinden farklı', () => {
  assert.ok(MAP_HEIGHT > 300 && MAP_HEIGHT < 600, `MAP_HEIGHT makul olmalı (${MAP_HEIGHT})`);
  const seen = new Set<string>();
  for (const d of getAllCityDefinitions()) {
    const { x, y } = d.mapPosition;
    assert.ok(Number.isFinite(x) && Number.isFinite(y), `${d.id} konumu sonlu olmalı`);
    assert.ok(x >= 0 && x <= MAP_WIDTH, `${d.id} x sınır dışı: ${x}`);
    assert.ok(y >= 0 && y <= MAP_HEIGHT, `${d.id} y sınır dışı: ${y}`);
    const key = `${x},${y}`;
    assert.ok(!seen.has(key), `${d.id} başka bir ilin tam üstünde duruyor`);
    seen.add(key);
  }
});

test('Şehir verisi: harita yönü doğru (İstanbul Ankara’nın batısında, Antalya Samsun’un güneyinde)', () => {
  const pos = (id: Parameters<typeof getCityDefinition>[0]) => getCityDefinition(id).mapPosition;
  assert.ok(pos('istanbul').x < pos('ankara').x);
  assert.ok(pos('ankara').x < pos('diyarbakir').x);
  assert.ok(pos('samsun').y < pos('antalya').y, 'Kuzey (Samsun) ekranda üstte olmalı');
  assert.ok(pos('edirne').x < pos('kars').x);
});

test('Şehir verisi: çarpanlar sonlu ve izin verilen aralıkta, bonuslar sınırlar içinde', () => {
  for (const d of getAllCityDefinitions()) {
    for (const key of MULTIPLIER_KEYS) {
      const v = d[key];
      assert.ok(Number.isFinite(v), `${d.id}.${key} sonlu olmalı`);
      assert.ok(
        v >= CITY_MULTIPLIER_MIN && v <= CITY_MULTIPLIER_MAX,
        `${d.id}.${key}=${v} aralık dışı`
      );
    }
    for (const bonus of [...Object.values(d.sectorBonuses), ...Object.values(d.shopBonuses)]) {
      assert.ok(Number.isFinite(bonus));
      assert.ok(bonus >= CITY_BONUS_MIN && bonus <= CITY_BONUS_MAX, `${d.id} bonus aralık dışı: ${bonus}`);
    }
  }
});

test('Şehir verisi: avantaj/dezavantaj ve oyun tarzı metinleri boş değil', () => {
  for (const d of getAllCityDefinitions()) {
    assert.ok(d.nameTR.trim().length > 0, `${d.id} adı boş`);
    assert.ok(d.playStyleTR.trim().length > 0, `${d.id} oyun tarzı boş`);
    assert.ok(d.advantagesTR.length >= 2 && d.advantagesTR.length <= 4, `${d.id} avantaj sayısı 2–4 olmalı`);
    assert.ok(d.disadvantagesTR.length >= 2 && d.disadvantagesTR.length <= 4, `${d.id} dezavantaj sayısı 2–4 olmalı`);
    for (const t of [...d.advantagesTR, ...d.disadvantagesTR]) {
      assert.ok(t.trim().length > 0);
    }
  }
});

test('İlk 12 şehir şartnamedeki sırayla detaylı, kalan 69 il dengeli varsayılan profilde', () => {
  assert.deepEqual(
    [...DETAILED_CITY_IDS],
    [
      'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'konya',
      'gaziantep', 'mersin', 'samsun', 'kayseri', 'trabzon', 'diyarbakir',
    ]
  );
  assert.equal(DETAILED_CITY_IDS.length, DETAILED_CITY_COUNT);
  assert.equal(getDetailedCityDefinitions().length, 12);
  for (const d of getAllCityDefinitions()) {
    const detailed = (DETAILED_CITY_IDS as readonly string[]).includes(d.id);
    assert.equal(d.profileKind, detailed ? 'DETAILED' : 'DEFAULT');
    if (!detailed) {
      for (const key of MULTIPLIER_KEYS) assert.equal(d[key], DEFAULT_CITY_PROFILE[key]);
      assert.deepEqual(d.sectorBonuses, {});
      assert.deepEqual(d.shopBonuses, {});
    }
  }
});

test('Şehir dengesi: hiçbir şehir başka bir şehri her ölçüde geçmez (kesin en iyi şehir yok)', () => {
  // Talep ve satın alma gücü yüksek = iyi; kira, ücret, lojistik, rekabet düşük = iyi.
  const better = (a: CityDefinition, b: CityDefinition) =>
    a.demandMultiplier >= b.demandMultiplier &&
    a.purchasingPowerMultiplier >= b.purchasingPowerMultiplier &&
    a.rentMultiplier <= b.rentMultiplier &&
    a.wageMultiplier <= b.wageMultiplier &&
    a.logisticsMultiplier <= b.logisticsMultiplier &&
    a.competitionMultiplier <= b.competitionMultiplier;
  const identical = (a: CityDefinition, b: CityDefinition) => better(a, b) && better(b, a);

  // 12 detaylı şehir + dengeli varsayılan profil (diğer 69 ili temsil eder)
  const pool: CityDefinition[] = [
    ...getDetailedCityDefinitions(),
    getCityDefinition('sinop'), // varsayılan profil temsilcisi
  ];
  for (const a of pool) {
    for (const b of pool) {
      if (a.id === b.id) continue;
      assert.ok(
        !better(a, b) || identical(a, b),
        `${a.id}, ${b.id} şehrini her ölçüde geçiyor: kesin en iyi seçim olurdu`
      );
    }
  }
});

test('Şehir dengesi: zorluk seviyeleri dağılımı ve büyük şehir/ucuz şehir ayrımı mantıklı', () => {
  const d = getDetailedCityDefinitions();
  for (const level of ['EASY', 'MEDIUM', 'HARD'] as const) {
    assert.ok(d.some((c) => c.difficulty === level), `${level} seviyesinde en az bir şehir olmalı`);
  }
  const ist = getCityDefinition('istanbul');
  const kon = getCityDefinition('konya');
  assert.ok(ist.demandMultiplier > kon.demandMultiplier, 'İstanbul’un talebi Konya’dan yüksek olmalı');
  assert.ok(ist.rentMultiplier > kon.rentMultiplier, 'İstanbul’un kirası Konya’dan yüksek olmalı');
  assert.ok(
    getCityDefinition('mersin').logisticsMultiplier < getCityDefinition('diyarbakir').logisticsMultiplier,
    'Limanlı Mersin lojistiği Diyarbakır’dan ucuz olmalı'
  );
});

test('isCityId: bilinmeyen, boş ve yanlış tipli değerleri eler', () => {
  assert.equal(isCityId('istanbul'), true);
  assert.equal(isCityId('duzce'), true);
  for (const bad of ['', 'Istanbul', 'atlantis', 'ankara ', null, undefined, 34, {}, []]) {
    assert.equal(isCityId(bad), false, `${String(bad)} geçersiz sayılmalı`);
  }
});

test('Çarpan koruması: NaN, Infinity ve negatif değer nötr (1) olur, geçerli değer sıkıştırılır', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.equal(clampCityMultiplier(bad), 1);
    assert.equal(clampCityBonus(bad), 0);
  }
  assert.equal(clampCityMultiplier(-3), CITY_MULTIPLIER_MIN, 'Negatif sonlu değer alt sınıra çekilir');
  assert.equal(clampCityMultiplier(99), CITY_MULTIPLIER_MAX);
  assert.equal(clampCityMultiplier(1.25), 1.25);
  assert.equal(clampCityBonus(5), CITY_BONUS_MAX);
  assert.equal(clampCityBonus(-5), CITY_BONUS_MIN);
});

test('Tanımlar dondurulmuş: çalışma anında yanlışlıkla değiştirilemez', () => {
  const ist = getCityDefinition('istanbul');
  assert.ok(Object.isFrozen(ist));
  assert.throws(() => {
    (ist as { demandMultiplier: number }).demandMultiplier = 99;
  });
});
