/**
 * Şehir ekonomisi denetimi. Çalıştırmak için:  npm run city-audit
 *
 * Kuralların gerçekten tuttuğunu kodla doğrular (her satır GEÇTİ/KALDI; kalan varsa çıkış kodu 1):
 *  1. Veri: 81 ilin bütün çarpanları sonlu ve sınırlar içinde; bozuk sayılar (NaN, sonsuz, negatif) 1'e düşer.
 *  2. Teklif: Ankara'dan Konya ile İstanbul'a açılış farklı maliyet çıkarır; uzak şehir yasak değildir.
 *  3. Teklif = defter: açılışta cepten düşen para ve defter satırlarının toplamı tekliften sapmaz (12 şehir).
 *  4. Aynı açılış isteği iki kez gelirse çift dükkân ve çift tahsilat olmaz.
 *  5. Lojistik: mesafe çarpanları 1,00/1,10/1,25/1,50; liman %15, depo %20 bir kez; sipariş nakliyesi ve defter satırı tutar.
 *  6. Çevrimiçi ve çevrimdışı ilerleme aynı sonucu verir (şehirli dükkânda).
 *  7. Hiçbir şehir bütün dükkân türlerinde ve bütün sektörlerde en iyi değildir.
 */
import { SimulationEngine } from '../src/engine/SimulationEngine';
import { CITY_IDS, CITY_DEFINITIONS, DETAILED_CITY_IDS, getCityDefinition } from '../src/data/cityDefinitions';
import { CITY_MULTIPLIER_MAX, CITY_MULTIPLIER_MIN } from '../src/data/cityBalance';
import {
  cityDemandLayers, cityRentFactor, cityWageFactor, computeLogisticsRoute, distanceFactor, distanceKind, safeMultiplier,
} from '../src/engine/CityEconomy';
import { measureShopEbitda, SHOP_ORDER } from '../src/tests/balance/cityBot';
import type { CityId } from '../src/models/cities';
import { WalletEngine } from '../src/engine/WalletEngine';
import { restockShops } from '../src/tests/balance/restockBot';

let failed = 0;
const check = (ok: boolean, label: string, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'GEÇTİ ' : 'KALDI '} ${label}${detail ? ' — ' + detail : ''}`);
};
const money = (n: number) => Math.round(n).toLocaleString('tr-TR');
const richEngine = (seed: number, cash = 20_000_000) => {
  const e = new SimulationEngine(seed, cash);
  e.chooseStartCity('ankara');
  return e;
};

// 1) Veri ---------------------------------------------------------------
console.log('=== 1) VERİ ===');
{
  let bad = '';
  for (const id of CITY_IDS) {
    const d = CITY_DEFINITIONS[id];
    for (const k of ['demandMultiplier', 'rentMultiplier', 'wageMultiplier', 'logisticsMultiplier', 'competitionMultiplier', 'purchasingPowerMultiplier'] as const) {
      const v = d[k];
      if (!Number.isFinite(v) || v < CITY_MULTIPLIER_MIN || v > CITY_MULTIPLIER_MAX) bad += `${id}.${k}=${v} `;
    }
    for (const f of [cityRentFactor(id), cityWageFactor(id)]) if (!Number.isFinite(f) || f <= 0) bad += `${id} oran `;
    const L = cityDemandLayers(id, 'BUFE', 100);
    for (const v of Object.values(L)) if (!Number.isFinite(v) || v <= 0) bad += `${id} katman `;
  }
  check(CITY_IDS.length === 81 && bad === '', `${CITY_IDS.length} ilin çarpanları sonlu ve sınırlar içinde`, bad);
  check(
    [NaN, Infinity, -Infinity, -2, 0, undefined, null, '3'].every((x) => safeMultiplier(x as never) === 1) && safeMultiplier(99) === CITY_MULTIPLIER_MAX,
    'Bozuk sayılar (NaN, sonsuz, negatif, sıfır, yazı) 1 olur; büyük sayı sınıra kesilir'
  );
  check(cityRentFactor('ankara') === 1 && cityWageFactor('ankara') === 1 && cityRentFactor(undefined) === 1, 'Ankara (referans) ve şehri olmayan dükkân tarafsız: çarpanlar 1,00');
}

// 2) Teklif ----------------------------------------------------------------
console.log('\n=== 2) AÇILIŞ TEKLİFİ (merkez Ankara, 2. dükkân, BÜFE) ===');
{
  const e = richEngine(101);
  e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
  const rows = DETAILED_CITY_IDS.map((id) => ({ id, q: e.getCityExpansionQuote(id as CityId, 'MANAV') }));
  console.log(`${'Şehir'.padEnd(12)}${'Mesafe'.padEnd(16)}${'Kurulum'.padStart(10)}${'Depozito'.padStart(10)}${'Ruhsat'.padStart(9)}${'Hat'.padStart(8)}${'Toplam'.padStart(10)}${'Rezerv'.padStart(10)}${'Teslim'.padStart(8)}`);
  for (const { id, q } of rows) {
    console.log(`${getCityDefinition(id).nameTR.padEnd(12)}${q.distanceKind.padEnd(16)}${money(q.baseSetupCost).padStart(10)}${money(q.cityRentDeposit).padStart(10)}${money(q.regionalPermitCost).padStart(9)}${money(q.initialLogisticsCost).padStart(8)}${money(q.totalUpfrontCost).padStart(10)}${money(q.recommendedReserve).padStart(10)}${(q.estimatedDeliveryDays + ' gün').padStart(8)}`);
  }
  const konya = rows.find((r) => r.id === 'konya')!.q;
  const istanbul = rows.find((r) => r.id === 'istanbul')!.q;
  check(konya.totalUpfrontCost !== istanbul.totalUpfrontCost, "Ankara'dan Konya ve İstanbul'a açılış farklı maliyet", `${money(konya.totalUpfrontCost)} ≠ ${money(istanbul.totalUpfrontCost)}`);
  const far = rows.find((r) => r.id === 'trabzon')!.q;
  const farOpen = richEngine(102);
  farOpen.openShop({ shopType: 'BUFE', cityId: 'ankara' });
  const res = farOpen.openShop({ shopType: 'MANAV', cityId: 'diyarbakir' });
  check(res.success, 'Uzak şehir seçmek yasak değil (komşu kilidi, bölge sırası, net değer kilidi yok)', res.message);
  check(far.distanceKind !== 'SAME_CITY' && far.regionalPermitCost > 0, 'Uzak şehirde ruhsat ve hat kurulumu ek maliyet olarak görünür');
  // Gerçek uzak bölge: merkez İstanbul (Marmara) → Diyarbakır (Güneydoğu) komşu değildir
  const ist = new SimulationEngine(104, 20_000_000);
  ist.chooseStartCity('istanbul');
  ist.openShop({ shopType: 'BUFE', cityId: 'istanbul' });
  const fq = ist.getCityExpansionQuote('diyarbakir' as CityId, 'MANAV');
  const fres = ist.openShop({ shopType: 'MANAV', cityId: 'diyarbakir' });
  check(fq.distanceKind === 'FAR_REGION' && fq.distanceFactor === 1.5 && fres.success, 'Uzak bölge (İstanbul → Diyarbakır, ×1,50) seçilebilir; ruhsat ve hat kurulumu daha pahalı', `ruhsat ${money(fq.regionalPermitCost)} · hat ${money(fq.initialLogisticsCost)}`);
  check(fq.warningsTR.some((w) => w.includes('Uzak bölge')), 'Uzak şehir uyarısı açıkça yazılır');
  // Yalnızca gerçekten yetersiz nakitte engel: 150 bin nakit ilk dükkân kapısını geçer ama galeriye yetmez
  const poor = new SimulationEngine(103, 150_000);
  poor.chooseStartCity('ankara');
  const pq = poor.getCityExpansionQuote('istanbul', 'OTOMOBIL_GALERISI');
  const pres = poor.openShop({ shopType: 'OTOMOBIL_GALERISI', cityId: 'istanbul' });
  check(!pq.affordable && !pres.success && pres.message.includes('aşıyor'), 'Yalnızca gerçekten yetersiz nakitte engellenir', pres.message.slice(0, 60));
  const tight = new SimulationEngine(105, 20_000_000);
  tight.chooseStartCity('ankara');
  tight.openShop({ shopType: 'BUFE', cityId: 'ankara' });
  const base = tight.getCityExpansionQuote('konya', 'MANAV', 4_000);
  WalletEngine.setBalance(tight.getState(), base.totalUpfrontCost + 2_000);
  const tq = tight.getCityExpansionQuote('konya', 'MANAV', 4_000);
  check(tq.affordable && tq.warningLevel !== 'NONE' && tq.needsSecondConfirmation, 'Rezervin altında kalınıyorsa engel yok, ikinci onay istenir', `seviye ${tq.warningLevel}`);
  const tres = tight.openShop({ shopType: 'MANAV', cityId: 'konya', initialCashFloat: 4_000 });
  check(tres.success, 'Rezervin altında olsa da motor açılışı engellemez (onay arayüzde istenir)');
}

// 3) Teklif = defter ---------------------------------------------------------
console.log('\n=== 3) TEKLİF = GERÇEK TAHSİLAT (12 şehir) ===');
{
  let ok = 0;
  const lines: string[] = [];
  for (const id of DETAILED_CITY_IDS) {
    const e = richEngine(200 + ok);
    e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
    const st = e.getState();
    const q = e.getCityExpansionQuote(id as CityId, 'KAFE');
    const cash0 = st.cash;
    const seq = st.tradeState!.shopSeq + 1;
    const day = st.day;
    const r = e.openShop({ shopType: 'KAFE', cityId: id });
    const spent = cash0 - e.getState().cash;
    const txs = (e.getState().centralLedger?.transactions ?? []).filter((t) => (t.idempotencyKey ?? '').startsWith('SHOP-OPEN-') && (t.idempotencyKey ?? '').endsWith(`-D${day}-S${seq}`));
    const ledgerSum = txs.reduce((s, t) => s + t.amount, 0);
    const good = r.success && Math.abs(spent - q.totalUpfrontCost) < 0.01 && Math.abs(ledgerSum - q.totalUpfrontCost) < 0.01;
    if (good) ok++;
    else lines.push(`${id}: teklif ${q.totalUpfrontCost} · düşen ${spent} · defter ${ledgerSum}`);
  }
  check(ok === DETAILED_CITY_IDS.length, 'Cepten düşen para ve defter satırlarının toplamı teklifle birebir aynı', lines.join(' | '));
}

// 4) Çift işlem ---------------------------------------------------------------
console.log('\n=== 4) AYNI İŞLEM İKİ KEZ ===');
{
  const e = richEngine(301);
  e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
  const cash0 = e.getState().cash;
  const a = e.openShop({ shopType: 'MANAV', cityId: 'konya', requestId: 'tek-dokunus' });
  const cash1 = e.getState().cash;
  const b = e.openShop({ shopType: 'MANAV', cityId: 'konya', requestId: 'tek-dokunus' });
  check(a.success && b.success && b.duplicate === true, 'İkinci çağrı "zaten açıldı" döner');
  check(e.getState().tradeState!.shops.length === 2, 'Çift dükkân oluşmaz', `dükkân sayısı ${e.getState().tradeState!.shops.length}`);
  check(Math.abs(cash1 - e.getState().cash) < 0.001 && cash0 > cash1, 'Çift tahsilat olmaz');
}

// 5) Lojistik ----------------------------------------------------------------
console.log('\n=== 5) LOJİSTİK (merkez Ankara) ===');
{
  const e = richEngine(401);
  const st = e.getState();
  console.log(`${'Hedef'.padEnd(12)}${'Mesafe'.padEnd(18)}${'Şehir'.padStart(7)}${'Mesafe×'.padStart(9)}${'Liman'.padStart(7)}${'İndirim'.padStart(9)}${'Nakliye×'.padStart(10)}`);
  for (const id of DETAILED_CITY_IDS) {
    const r = computeLogisticsRoute(st, id, {});
    console.log(`${getCityDefinition(id).nameTR.padEnd(12)}${r.kind.padEnd(18)}${r.cityFactor.toFixed(2).padStart(7)}${r.distance.toFixed(2).padStart(9)}${(r.port ? 'var' : '-').padStart(7)}${('%' + Math.round(r.discount * 100)).padStart(9)}${r.multiplier.toFixed(2).padStart(10)}`);
  }
  check(distanceFactor('ankara', 'ankara') === 1 && distanceFactor('ankara', 'konya') === 1.1 && distanceFactor('ankara', 'istanbul') === 1.25 && distanceFactor('ankara', 'trabzon') === 1.25 && distanceFactor('istanbul', 'diyarbakir') === 1.5,
    'Mesafe çarpanları: aynı şehir 1,00 · aynı bölge 1,10 · komşu bölge 1,25 · uzak bölge 1,50');
  const portOnly = computeLogisticsRoute(st, 'izmir', {});
  check(portOnly.port && !portOnly.depot && Math.abs(portOnly.discount - 0.15) < 1e-9, 'Liman indirimi %15');
  // Depo: şehre depo kur → %20 daha; iki kez kurmak ya da aynı rotada iki kez saymak indirimi artırmaz
  const wh = st.tradeState!.warehouses;
  wh.push({ warehouseId: 'WH_CITY_IZMIR', nameTR: 'İzmir Şehir Deposu', type: 'DISTRIBUTION', level: 1, maxCapacityUnits: 4000, usedCapacityUnits: 0, dailyOperatingCost: 0, dailyStorageCostPerUnit: 1, spoilageProtectionFactor: 1, batches: [], cityId: 'izmir' });
  wh.push({ warehouseId: 'WH_CITY_IZMIR_2', nameTR: 'İzmir 2. Depo', type: 'DISTRIBUTION', level: 1, maxCapacityUnits: 4000, usedCapacityUnits: 0, dailyOperatingCost: 0, dailyStorageCostPerUnit: 1, spoilageProtectionFactor: 1, batches: [], cityId: 'izmir' });
  const both = computeLogisticsRoute(st, 'izmir', {});
  check(both.port && both.depot && Math.abs(both.discount - 0.35) < 1e-9, 'Liman + depo indirimi toplanır (%35), iki depo olsa da depo indirimi bir kez');
  wh[wh.length - 2].usedCapacityUnits = 3990;
  wh[wh.length - 1].usedCapacityUnits = 3990;
  const full = computeLogisticsRoute(st, 'izmir', { quantity: 100 });
  check(!full.depot, 'Depo kapasitesi doluysa depo indirimi verilmez');
  check(distanceKind('ankara', 'konya') === 'SAME_REGION' && distanceKind('ankara', 'diyarbakir') === 'NEIGHBOR_REGION', 'Bölge komşuluğu doğru okunur');

  // Gerçek sipariş: nakliye = taban × çarpan, defterde ayrı "Lojistik" satırı
  const e2 = richEngine(402);
  e2.openShop({ shopType: 'BUFE', cityId: 'ankara' });
  const near = e2.openShop({ shopType: 'MANAV', cityId: 'ankara' }).shop!;
  const farShop = e2.openShop({ shopType: 'KAFE', cityId: 'diyarbakir' }).shop!;
  const resId = e2.getSupplierOffers()[0].resourceId;
  const sup = e2.getSupplierOffers(resId)[0];
  const orderFor = (shopId: string) => e2.placeProcurementOrder({ supplierId: sup.supplierId, resourceId: resId, quantity: Math.max(sup.minOrderQuantity, 20), destinationType: 'SHOP', destinationId: shopId, paymentTermType: 'CASH' });
  const nearOrder = orderFor(near.shopId);
  const farOrder = orderFor(farShop.shopId);
  const ratio = farOrder.order && nearOrder.order ? (farOrder.order.shippingCost / farOrder.order.orderedQuantity) / (nearOrder.order.shippingCost / nearOrder.order.orderedQuantity) : NaN;
  const expected = computeLogisticsRoute(e2.getState(), 'diyarbakir', { quantity: 20 }).multiplier / computeLogisticsRoute(e2.getState(), 'ankara', { quantity: 20 }).multiplier;
  check(Number.isFinite(ratio) && Math.abs(ratio - expected) < 0.03, 'Uzak şehre nakliye, yakın şehre göre hesaplanan çarpan kadar pahalı', `${ratio.toFixed(3)} ≈ ${expected.toFixed(3)}`);
  const logi = (e2.getState().centralLedger?.transactions ?? []).filter((t) => (t.idempotencyKey ?? '').startsWith('LOGISTICS-'));
  check(logi.length >= 2 && farOrder.order !== null && logi.some((t) => (t.idempotencyKey ?? '') === `LOGISTICS-${farOrder.order!.orderId}` && Math.abs(t.amount - farOrder.order!.shippingCost) < 0.01), "Lojistik maliyeti defterde ayrı satır (sipariş numarasıyla)", `${logi.length} satır`);
}

// 6) Çevrimiçi = çevrimdışı ------------------------------------------------------
console.log('\n=== 6) ÇEVRİMİÇİ = ÇEVRİMDIŞI ===');
{
  const make = () => {
    const e = richEngine(501);
    e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
    e.openShop({ shopType: 'KAFE', cityId: 'antalya' });
    restockShops(e);
    e.advanceDaysWithoutPlayerDecisions(2, true);
    restockShops(e);
    return e;
  };
  const a = make();
  const b = make();
  a.advanceGameMinutes(3 * 1440 - a.getState().minutesIntoCurrentDay);
  b.advanceDaysWithoutPlayerDecisions(3, true);
  const sa = a.getState().tradeState!.shops;
  const sb = b.getState().tradeState!.shops;
  const same = sa.every((s, i) => s.cumulativeRevenue === sb[i].cumulativeRevenue && s.cashAccountBalance === sb[i].cashAccountBalance && s.todayRentAndOpex === sb[i].todayRentAndOpex && s.todayPayrollCost === sb[i].todayPayrollCost);
  check(same, 'Canlı oynanan gün ve hızlı ilerletilen gün şehirli dükkânda kuruşu kuruşuna aynı', sa.map((s) => `${s.cityId}:${s.cumulativeRevenue}`).join(' '));
}

// 7) Hiçbir şehir her yerde en iyi değil ------------------------------------------
console.log('\n=== 7) KESİN EN İYİ ŞEHİR YOK MU? ===');
{
  const eb: Record<string, Record<string, number>> = {};
  for (const id of DETAILED_CITY_IDS) {
    eb[id] = {};
    for (const t of SHOP_ORDER) eb[id][t] = measureShopEbitda(id, t, 11, { days: 365 }).ebitdaPerDay;
  }
  const bestCount: Record<string, number> = {};
  for (const t of SHOP_ORDER) {
    const b = [...DETAILED_CITY_IDS].sort((x, y) => eb[y][t] - eb[x][t])[0];
    bestCount[b] = (bestCount[b] ?? 0) + 1;
  }
  console.log('Dükkân türü başına en iyi şehir sayısı: ' + Object.entries(bestCount).map(([k, v]) => `${k} ${v}`).join(', '));
  check(!Object.values(bestCount).some((n) => n === SHOP_ORDER.length), 'Hiçbir şehir 8 dükkân türünün hepsinde en iyi değil');
  check(Math.max(...Object.values(bestCount)) <= 4, 'Hiçbir şehir dükkân türlerinin yarısından fazlasında en iyi değil', `en çok ${Math.max(...Object.values(bestCount))}`);
  const sectors = ['TEKNOLOJI', 'ENERJI', 'FINANS', 'BIYOTEKNOLOJI', 'SAVUNMA', 'PERAKENDE', 'LOJISTIK', 'MADENCILIK'] as const;
  const sbest: Record<string, number> = {};
  for (const s of sectors) {
    const b = [...DETAILED_CITY_IDS].sort((x, y) => (CITY_DEFINITIONS[y].sectorBonuses[s] ?? 0) - (CITY_DEFINITIONS[x].sectorBonuses[s] ?? 0))[0];
    sbest[b] = (sbest[b] ?? 0) + 1;
  }
  check(!Object.values(sbest).some((n) => n === sectors.length), 'Hiçbir şehir 8 sektörün hepsinde en yüksek bonusa sahip değil', Object.entries(sbest).map(([k, v]) => `${k} ${v}`).join(', '));
}

console.log(`\n${failed === 0 ? 'HEPSİ GEÇTİ' : `${failed} KONTROL KALDI`}`);
process.exit(failed === 0 ? 0 : 1);
