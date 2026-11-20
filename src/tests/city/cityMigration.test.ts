import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStore, type SavedSimulationEnvelope } from '../../state/simulationStore';
import {
  applyHeadquartersSelection,
  getCityPresence,
  getShopsNeedingCity,
  isCitySelectionPending,
  prepareCityMigration,
  resolveNewShopCityId,
} from '../../engine/CityMigration';
import { CITY_FALLBACK_ID, CITY_MIGRATION_BACKUP_KEY } from '../../data/cityBalance';
import type { SimulationState } from '../../models/simulation';

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

type RawState = Record<string, any>;

/** Şehir sistemi öncesi (şema v5) bir kayıt zarfı üretir: cityId ve şehir alanları yoktur. */
function makeLegacyEnvelope(
  engine: SimulationEngine,
  mutate?: (raw: RawState) => void
): SavedSimulationEnvelope {
  const raw: RawState = JSON.parse(engine.serializeState());
  raw.schemaVersion = 5;
  delete raw.cityMigration;
  delete raw.headquartersCityId;
  delete raw.playerStartCityId;
  delete raw.selectedMapCityId;
  delete raw.turkeyMapView;
  for (const shop of raw.tradeState?.shops ?? []) delete shop.cityId;
  mutate?.(raw);
  return {
    schemaVersion: 5,
    savedAtISO: '2026-11-05T10:00:00.000Z',
    seed: raw.seed,
    randomState: raw.randomState,
    state: raw as SimulationState,
  } as SavedSimulationEnvelope;
}

function engineWithShops(types: Array<'BUFE' | 'KAFE' | 'MARKET' | 'MANAV'>, cash = 5_000_000) {
  const eng = new SimulationEngine(20261120, cash);
  for (const t of types) {
    const res = eng.openShop({ shopType: t });
    assert.equal(res.success, true, `${t} açılmalı: ${res.message}`);
  }
  return eng;
}

function migrate(env: SavedSimulationEnvelope): SavedSimulationEnvelope {
  const out = SimulationStore.migrateIfNeeded(JSON.parse(JSON.stringify(env)));
  assert.ok(out, 'Migration null dönmemeli');
  return out!;
}

/** Şehir dışındaki dükkân alanlarını karşılaştırmak için cityId'siz kopya. */
function shopsWithoutCity(state: Pick<SimulationState, 'tradeState'>) {
  return (state.tradeState?.shops ?? []).map((s) => {
    const { cityId: _ignored, ...rest } = s;
    return rest;
  });
}

function withMockWindow(run: (storage: Map<string, string>) => void) {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
  const g = globalThis as any;
  const hadWindow = 'window' in g;
  const prev = g.window;
  g.window = { localStorage };
  try {
    run(store);
  } finally {
    if (hadWindow) g.window = prev;
    else delete g.window;
  }
}

// ---------------------------------------------------------------------------
// Migration senaryoları
// ---------------------------------------------------------------------------

test('Senaryo 1: hiç dükkânı olmayan eski kayıt açılır, seçim ekranı gerekmez', () => {
  const env = makeLegacyEnvelope(new SimulationEngine(1, 800_000));
  const out = migrate(env);
  assert.equal(out.schemaVersion, SimulationStore.CURRENT_SCHEMA_VERSION);
  assert.equal(out.schemaVersion, 6);
  assert.equal(out.state.cityMigration?.status, 'COMPLETED');
  assert.equal(out.state.cityMigration?.assignedShopCount, 0);
  assert.equal(isCitySelectionPending(out.state), false);
  assert.equal(out.state.cash, env.state.cash, 'Para değişmemeli');
});

test('Senaryo 2: tek dükkânlı eski kayıt seçim bekler; seçince dükkân o şehre taşınır, para aynı kalır', () => {
  const eng = engineWithShops(['BUFE']);
  const env = makeLegacyEnvelope(eng);
  assert.equal(env.state.tradeState!.shops.length, 1);
  assert.equal(env.state.tradeState!.shops[0].cityId, undefined);

  const out = migrate(env);
  assert.equal(out.state.cityMigration?.status, 'PENDING');
  assert.equal(isCitySelectionPending(out.state), true);
  assert.equal(getShopsNeedingCity(out.state).length, 1);
  assert.equal(out.state.headquartersCityId, undefined, 'Oyuncu seçmeden merkez atanmamalı (otomatik Ankara yok)');

  const before = JSON.parse(JSON.stringify(out.state)) as SimulationState;
  const res = applyHeadquartersSelection(out.state, 'konya', '2026-11-20T12:00:00.000Z');
  assert.equal(res.success, true);
  assert.equal(res.assignedShopCount, 1);
  assert.equal(out.state.tradeState!.shops[0].cityId, 'konya');
  assert.equal(out.state.headquartersCityId, 'konya');
  assert.equal(out.state.playerStartCityId, 'konya');
  assert.equal(out.state.cityMigration?.status, 'COMPLETED');
  assert.equal(isCitySelectionPending(out.state), false);

  // Para ve borç alanları dokunulmamış
  for (const key of ['cash', 'personalCash', 'investmentCash', 'holdingCash', 'netWorth', 'totalDebt', 'shortTermDebt', 'longTermDebt', 'businessLoanFund'] as const) {
    assert.equal(out.state[key], before[key], `${key} değişmemeli`);
  }
  assert.deepEqual(shopsWithoutCity(out.state), shopsWithoutCity(before), 'Dükkân alanları (şehir hariç) birebir aynı kalmalı');
});

test('Senaryo 3: farklı seviyelerde birden fazla dükkân hepsi seçilen şehre atanır, seviye/kasa/ID korunur', () => {
  const eng = engineWithShops(['BUFE', 'KAFE', 'MARKET', 'MANAV']);
  const env = makeLegacyEnvelope(eng, (raw) => {
    const shops = raw.tradeState.shops;
    shops[1].level = 2;
    shops[2].level = 3;
    shops[2].cashAccountBalance = 123_456.78;
    shops[3].staffCount = 5;
    shops[3].manager = { hired: true };
    shops[0].upgrades = ['sign'];
  });
  const originalIds = env.state.tradeState!.shops.map((s) => s.shopId);
  const out = migrate(env);
  assert.equal(getShopsNeedingCity(out.state).length, 4);

  const res = applyHeadquartersSelection(out.state, 'izmir');
  assert.equal(res.assignedShopCount, 4);
  const shops = out.state.tradeState!.shops;
  assert.deepEqual(shops.map((s) => s.shopId), originalIds, 'Dükkân ID’leri korunmalı');
  assert.ok(shops.every((s) => s.cityId === 'izmir'));
  assert.equal(shops[1].level, 2);
  assert.equal(shops[2].level, 3);
  assert.equal(shops[2].cashAccountBalance, 123_456.78);
  assert.equal(shops[3].staffCount, 5);
  assert.deepEqual(shops[3].manager, { hired: true });
  assert.deepEqual(shops[0].upgrades, ['sign']);
  assert.deepEqual(shopsWithoutCity(out.state), shopsWithoutCity(env.state), 'Şehir dışında hiçbir alan değişmemeli');
});

test('Senaryo 4: şirketi ve kredisi olan kayıtta para, borç, kredi ve şirket bilançosu korunur', () => {
  const eng = new SimulationEngine(486001, 6_000_000);
  eng.openShop({ shopType: 'BUFE' });
  const est = eng.establishCompany('Test Sanayi A.Ş.', 'TSTS', 'TEKNOLOJI', 2_500_000, {
    initialStaffCount: 40,
    initialCapacity: 4_000,
    initialRdBudget: 20_000,
  });
  assert.ok(est);
  const loan = eng.takeOutBankLoan({ loanType: 'WORKING_CAPITAL', principal: 300_000, termInGameDays: 90 });
  const env = makeLegacyEnvelope(eng);
  const out = migrate(env);
  const before = JSON.parse(JSON.stringify(out.state)) as SimulationState;
  applyHeadquartersSelection(out.state, 'ankara');

  assert.equal(out.state.cash, env.state.cash);
  assert.equal(out.state.totalDebt, env.state.totalDebt);
  assert.equal(out.state.netWorth, env.state.netWorth);
  assert.deepEqual(out.state.activeLoans, before.activeLoans);
  assert.deepEqual(out.state.playerCompany, before.playerCompany);
  assert.deepEqual(out.state.centralLedger, before.centralLedger);
  assert.equal(out.state.businessLoanFund, before.businessLoanFund, 'Kısıtlı bakiye korunmalı');
  if (loan.success) assert.ok((out.state.activeLoans ?? []).length >= 1);
});

test('Senaryo 5: holding ve prestij yapmış kayıtta prestij, aşama ve başarım ilerlemesi korunur', () => {
  const eng = engineWithShops(['BUFE', 'KAFE']);
  const env = makeLegacyEnvelope(eng, (raw) => {
    raw.prestige = { stars: 3, cities: 2, bestNetWorth: 60_000_000 };
    raw.stageUnlocks = { ...raw.stageUnlocks, stage3Ipo: true, stage4Holding: true };
    raw.careerGoals = { claimed: ['goal-first-luxury'], totalRewards: 12_000 };
    raw.records = { bestDayGain: 999_000, bestDay: 41 };
    raw.lastOfflineProcessedTimestampISO = '2026-11-04T08:00:00.000Z';
  });
  const out = migrate(env);
  applyHeadquartersSelection(out.state, 'istanbul', '2026-11-20T12:00:00.000Z');
  assert.deepEqual(out.state.prestige, { stars: 3, cities: 2, bestNetWorth: 60_000_000 });
  assert.equal(out.state.stageUnlocks.stage4Holding, true);
  assert.deepEqual(out.state.careerGoals, { claimed: ['goal-first-luxury'], totalRewards: 12_000 });
  assert.deepEqual(out.state.records, { bestDayGain: 999_000, bestDay: 41 });
});

test('Senaryo 6: eksik veya bilinmeyen cityId içeren bozuk kayıt çökmez, hepsi seçim kuyruğuna girer', () => {
  const eng = engineWithShops(['BUFE', 'KAFE', 'MARKET', 'MANAV']);
  const env = makeLegacyEnvelope(eng, (raw) => {
    const s = raw.tradeState.shops;
    s[0].cityId = 'atlantis'; // bilinmeyen
    s[1].cityId = 42; // yanlış tip
    s[2].cityId = null; // boş
    s[3].cityId = 'istanbul'; // geçerli: dokunulmamalı
  });
  const out = migrate(env);
  assert.equal(out.state.cityMigration?.status, 'PENDING');
  assert.equal(getShopsNeedingCity(out.state).length, 3);
  assert.equal(out.state.cityMigration?.repairedShopCount, 3, 'Bozuk değerli dükkânlar sayılmalı');

  applyHeadquartersSelection(out.state, 'bursa');
  const ids = out.state.tradeState!.shops.map((s) => s.cityId);
  assert.deepEqual(ids, ['bursa', 'bursa', 'bursa', 'istanbul'], 'Geçerli şehri olan dükkân yerinde kalmalı');
});

test('Bozuk cityId ve zaten geçerli merkez şehri olan kayıtta oyuncuya sormadan onarılır', () => {
  const eng = engineWithShops(['BUFE', 'KAFE']);
  const env = makeLegacyEnvelope(eng, (raw) => {
    raw.schemaVersion = 6;
    raw.headquartersCityId = 'trabzon';
    raw.tradeState.shops[0].cityId = 'trabzon';
    raw.tradeState.shops[1].cityId = 'yok-boyle-sehir';
  });
  const out = migrate(env);
  assert.equal(isCitySelectionPending(out.state), false);
  assert.equal(out.state.tradeState!.shops[1].cityId, 'trabzon');
  assert.equal(out.state.cityMigration?.status, 'COMPLETED');
  assert.equal(out.state.cityMigration?.repairedShopCount, 1);
});

test('Senaryo 7: dışa/içe aktarılmış (serialize → deserialize) eski kayıt da seçim bekler ve veri kaybetmez', () => {
  const eng = engineWithShops(['BUFE', 'MARKET']);
  const env = makeLegacyEnvelope(eng);
  const imported = SimulationEngine.deserializeState(JSON.stringify(env.state));
  assert.equal(imported.isCitySelectionPending(), true);
  const st = imported.getState();
  assert.equal(st.tradeState!.shops.length, 2);
  assert.equal(st.cash, env.state.cash);

  const res = imported.completeHeadquartersSelection('mersin');
  assert.equal(res.success, true);
  assert.ok(imported.getState().tradeState!.shops.every((s) => s.cityId === 'mersin'));
  assert.equal(imported.isCitySelectionPending(), false);
});

test('Migration ve seçim ikinci kez çalışmaz (idempotent)', () => {
  const eng = engineWithShops(['BUFE', 'KAFE']);
  const out = migrate(makeLegacyEnvelope(eng));
  assert.equal(applyHeadquartersSelection(out.state, 'konya', '2026-11-20T12:00:00.000Z').success, true);
  const afterFirst = JSON.parse(JSON.stringify(out.state));

  // Aynı seçim ikinci kez: etkisiz
  const second = applyHeadquartersSelection(out.state, 'izmir', '2026-11-21T12:00:00.000Z');
  assert.equal(second.success, false);
  assert.equal(second.assignedShopCount, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(out.state)), afterFirst);

  // Tamamlanmış kaydı yeniden migrate etmek hiçbir şeyi değiştirmez
  const again = migrate(out);
  assert.deepEqual(again.state.cityMigration, afterFirst.cityMigration);
  assert.deepEqual(again.state.tradeState!.shops.map((s) => s.cityId), ['konya', 'konya']);
  assert.equal(again.state.headquartersCityId, 'konya');
  assert.equal(prepareCityMigration(again.state), false, 'prepare ikinci çağrıda değişiklik bildirmemeli');
});

test('Geçersiz şehir seçimi reddedilir, seçim beklemeye devam eder', () => {
  const out = migrate(makeLegacyEnvelope(engineWithShops(['BUFE'])));
  for (const bad of ['', 'atlantis', 'Istanbul', undefined, 34, null]) {
    const res = applyHeadquartersSelection(out.state, bad);
    assert.equal(res.success, false);
  }
  assert.equal(isCitySelectionPending(out.state), true);
  assert.equal(out.state.tradeState!.shops[0].cityId, undefined);
  assert.equal(out.state.headquartersCityId, undefined);
});

// ---------------------------------------------------------------------------
// Seçim tamamlanmadan ilerleme durmalı
// ---------------------------------------------------------------------------

test('Seçim beklerken gün/saat, çevrimdışı ilerleme, gün sonu ve yeni dükkân açma durur; seçince devam eder', () => {
  const eng = engineWithShops(['BUFE', 'KAFE']);
  const imported = SimulationEngine.deserializeState(JSON.stringify(makeLegacyEnvelope(eng).state));
  assert.equal(imported.isCitySelectionPending(), true);

  const s0 = JSON.parse(JSON.stringify(imported.getState())) as SimulationState;
  assert.deepEqual(imported.advanceGameMinutes(600), { gameMinutesAdvanced: 0, daysClosed: 0 });
  assert.deepEqual(imported.advanceRealSeconds(600), { gameMinutesAdvanced: 0, daysClosed: 0 });
  imported.tickDay();
  imported.closeCurrentDay();
  const off = imported.processOfflineProgress('2026-11-20T10:00:00.000Z', '2026-11-20T11:30:00.000Z');
  assert.equal(off.gameMinutesAdvanced, 0);
  assert.equal(off.gameDaysAdvanced, 0);
  assert.ok(off.warnings.some((w) => w.includes('Merkez şehir')));

  const open = imported.openShop({ shopType: 'MANAV' });
  assert.equal(open.success, false);

  const s1 = imported.getState();
  for (const key of ['day', 'minutesIntoCurrentDay', 'totalElapsedGameMinutes', 'cash', 'netWorth', 'lastRealTimestampISO'] as const) {
    assert.equal(s1[key], s0[key], `${key} seçim beklerken değişmemeli`);
  }
  assert.equal(s1.tradeState!.shops.length, 2);

  // Seçimden sonra oyun normal ilerler
  assert.equal(imported.completeHeadquartersSelection('ankara', '2026-11-20T12:00:00.000Z').success, true);
  assert.equal(imported.getState().lastRealTimestampISO, '2026-11-20T12:00:00.000Z', 'Bekleme süresi çevrimdışı kazanç sayılmamalı');
  const moved = imported.advanceGameMinutes(120);
  assert.equal(moved.gameMinutesAdvanced, 120);
  assert.equal(imported.openShop({ shopType: 'MANAV' }).success, true);
  assert.equal(imported.getState().tradeState!.shops.at(-1)!.cityId, 'ankara', 'Yeni dükkân merkez şehre açılır');
});

// ---------------------------------------------------------------------------
// Yedekleme ve kalıcılık (localStorage)
// ---------------------------------------------------------------------------

test('Senaryo 8: yükleme sırasında migration öncesi orijinal kayıt otomatik yedeklenir, ilk yedek korunur', () => {
  withMockWindow((store) => {
    const eng = engineWithShops(['BUFE', 'KAFE']);
    const rawJson = JSON.stringify(makeLegacyEnvelope(eng));
    store.set(SimulationStore.STORAGE_KEY, rawJson);

    const loaded = SimulationStore.loadFromStorage();
    assert.ok(loaded, 'Eski kayıt crash olmadan açılmalı');
    assert.equal(loaded!.isCitySelectionPending(), true);
    assert.equal(store.get(CITY_MIGRATION_BACKUP_KEY), rawJson, 'Yedek, migration öncesi orijinal içerikle birebir aynı olmalı');
    assert.equal(SimulationStore.BACKUP_PRE_CITY_KEY, CITY_MIGRATION_BACKUP_KEY);

    // Kalıcı kayıt yeni şemaya yazılmış ve seçim hâlâ bekliyor (ekranı kapatan oyuncuya tekrar sorulur)
    const persisted = JSON.parse(store.get(SimulationStore.STORAGE_KEY)!);
    assert.equal(persisted.schemaVersion, 6);
    assert.equal(persisted.state.cityMigration.status, 'PENDING');

    // Uygulama kapanıp yeniden açılır: hâlâ bekliyor, yedek ezilmedi
    const reopened = SimulationStore.loadFromStorage();
    assert.equal(reopened!.isCitySelectionPending(), true);
    assert.equal(store.get(CITY_MIGRATION_BACKUP_KEY), rawJson, 'İkinci açılışta yedek ezilmemeli');
  });
});

test('Senaryo 8b: seçim kaydedildikten sonra yeniden açılışta tekrar sorulmaz; yedekten dönen eski kayıt yine geçirilir', () => {
  withMockWindow((store) => {
    const eng = engineWithShops(['BUFE', 'MARKET']);
    const rawJson = JSON.stringify(makeLegacyEnvelope(eng));
    store.set(SimulationStore.STORAGE_KEY, rawJson);

    const loaded = SimulationStore.loadFromStorage()!;
    assert.equal(loaded.completeHeadquartersSelection('samsun').success, true);
    assert.ok(SimulationStore.saveToStorage(loaded));

    const reopened = SimulationStore.loadFromStorage()!;
    assert.equal(reopened.isCitySelectionPending(), false);
    assert.ok(reopened.getState().tradeState!.shops.every((s) => s.cityId === 'samsun'));
    assert.equal(reopened.getState().headquartersCityId, 'samsun');

    // Yedekten geri dönüş: orijinal eski kayıt tekrar seçim ister, veri kaybı yok
    store.set(SimulationStore.STORAGE_KEY, store.get(CITY_MIGRATION_BACKUP_KEY)!);
    const restored = SimulationStore.loadFromStorage()!;
    assert.equal(restored.isCitySelectionPending(), true);
    assert.equal(restored.getState().tradeState!.shops.length, 2);
    assert.equal(restored.getState().cash, eng.getState().cash);
  });
});

test('Yedek alınamazsa (depolama dolu) yükleme çökmez', () => {
  const failing = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.equal(SimulationStore.createPreCityMigrationBackup('{}', failing), false);
  assert.equal(SimulationStore.getLastError()?.category, 'QUOTA_ERROR');
  SimulationStore.clearLastError();
});

// ---------------------------------------------------------------------------
// Yeni dükkânlar ve varlık durumu
// ---------------------------------------------------------------------------

test('Yeni açılan dükkân her zaman cityId alır: merkez → başlangıç şehri → Ankara', () => {
  const fresh = new SimulationEngine(7, 2_000_000);
  assert.equal(resolveNewShopCityId(fresh.getState()), CITY_FALLBACK_ID);
  assert.equal(fresh.openShop({ shopType: 'BUFE' }).shop!.cityId, 'ankara');

  const withStart = new SimulationEngine(8, 2_000_000);
  withStart.getState().playerStartCityId = 'trabzon';
  assert.equal(withStart.openShop({ shopType: 'BUFE' }).shop!.cityId, 'trabzon');

  const withHq = new SimulationEngine(9, 2_000_000);
  withHq.getState().playerStartCityId = 'trabzon';
  withHq.getState().headquartersCityId = 'izmir';
  assert.equal(withHq.openShop({ shopType: 'BUFE' }).shop!.cityId, 'izmir');
});

test('Şehir varlık durumu: dükkânsız şehir EMPTY (gri), dükkânlı OWNED (beyaz), merkez HEADQUARTERS (altın)', () => {
  const eng = engineWithShops(['BUFE', 'KAFE']);
  const st = eng.getState();
  st.tradeState!.shops[0].cityId = 'bursa';
  st.tradeState!.shops[1].cityId = 'bursa';
  st.headquartersCityId = 'izmir';

  assert.deepEqual(getCityPresence(st, 'bursa'), { cityId: 'bursa', shopCount: 2, isHeadquarters: false, markerState: 'OWNED' });
  assert.deepEqual(getCityPresence(st, 'konya'), { cityId: 'konya', shopCount: 0, isHeadquarters: false, markerState: 'EMPTY' });
  assert.equal(getCityPresence(st, 'izmir').markerState, 'HEADQUARTERS');
});
