/**
 * YÜKSELTME NAKİT GÜVENLİK REZERVİ (ShopUpgrades)
 *
 *   upgradeSafetyReserve = nextSevenDaysRent + nextSevenDaysWages + recommendedStockOrder
 *
 * 1. Formül: bağımsız hesapla aynı çıkar (kira, maaş, stok ayrı ayrı)
 * 2. Eşikler: Yeşil (14+ gün), Sarı (7–13), Kırmızı (<7), Kritik (stok yenileme parası kalmıyor); sınır değerleri
 * 3. Yükseltme ASLA engellenmez: rezervin altında da alınır, nakit tam maliyet kadar düşer, güçlü uyarı mesajda yazar
 * 4. Uyarı kalan nakdi, önerilen rezervi ve 7 günlük gider tahminini yazar; rezervin üstünde uyarı yoktur
 * 5. Nakdi yetmeyen yükseltme eskisi gibi reddedilir; rezerve emir nakdi kalan nakde sayılmaz
 * 6. Arayüz: renkli eşik rozeti görünür, uyarı kartı ilk dokunuştan önce görünmez
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EsnafAndTradePanel } from '../../components/game/EsnafAndTradePanel';
import {
  UPGRADE_RESERVE_DAYS,
  UPGRADE_RESERVE_GREEN_DAYS,
  UPGRADE_RESERVE_YELLOW_DAYS,
} from '../../data/gameBalance';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { oneDayStockCost } from '../../engine/ShopOnboarding';
import { planShopRestock } from '../../engine/ShopRestockPlanner';
import { assessUpgradeCash, upgradeReserveLevel } from '../../engine/ShopUpgradeReserve';
import { WalletEngine } from '../../engine/WalletEngine';
import type { ShopInstance } from '../../models/trade';

const r2 = (v: number) => Number(v.toFixed(2));
const tl = (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`;

function openBufe(seed = 20281601): { eng: SimulationEngine; shop: ShopInstance } {
  const eng = new SimulationEngine(seed, 1_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const shop = eng.getState().tradeState!.shops[0];
  return { eng, shop };
}

/** Yükseltmeden SONRA elde tam `target` ₺ kalacak şekilde nakdi ayarlar (kişisel nakit 0, kalanı dükkân kasasında). */
function setCashAfter(eng: SimulationEngine, shop: ShopInstance, upgradeId: string, target: number): void {
  const a = assessUpgradeCash(eng.getState(), shop.shopId, upgradeId, 0)!;
  WalletEngine.setBalance(eng.getState(), 0);
  eng.getState().investmentCash = 0;
  shop.cashAccountBalance = r2(a.cost + target);
}

function totalCash(eng: SimulationEngine, shop: ShopInstance): number {
  return r2(eng.getState().cash + shop.cashAccountBalance);
}

// ---------------------------------------------------------------------------
// 1. Formül
// ---------------------------------------------------------------------------
test('1) upgradeSafetyReserve = 7 gün kira + 7 gün maaş + önerilen stok siparişi (bağımsız hesapla aynı)', () => {
  const { eng, shop } = openBufe();
  shop.staffCount = 3;
  const state = eng.getState();
  const a = assessUpgradeCash(state, shop.shopId, 'tabela', 0)!;

  const expectedRent7 = r2((shop.dailyRent + shop.level * 120) * UPGRADE_RESERVE_DAYS);
  const expectedWages7 = r2(3 * shop.staffDailyWagePerPerson * UPGRADE_RESERVE_DAYS);
  const expectedStock = r2(
    Math.min(planShopRestock(state, shop.shopId, Number.MAX_SAFE_INTEGER).totalCost, oneDayStockCost('BUFE'))
  );

  assert.equal(a.nextSevenDaysRent, expectedRent7);
  assert.equal(a.nextSevenDaysWages, expectedWages7);
  assert.ok(expectedWages7 > 0, 'maaş gerçekten hesaba girdi (test anlamlı)');
  assert.equal(a.nextSevenDaysExpenses, r2(expectedRent7 + expectedWages7));
  assert.equal(a.recommendedStockOrder, expectedStock);
  assert.ok(expectedStock > 0, 'boş raflı dükkânda stok önerisi var (test anlamlı)');
  assert.equal(a.upgradeSafetyReserve, r2(expectedRent7 + expectedWages7 + expectedStock));
  assert.equal(UPGRADE_RESERVE_DAYS, 7);
});

test('1b) Stok önerisi raflar doluysa 0, boşsa en çok bir günlük satış stokudur (50 bin ₺\'lik "bütün raflar" değil)', () => {
  const { eng, shop } = openBufe();
  const empty = assessUpgradeCash(eng.getState(), shop.shopId, 'tabela', 0)!;
  assert.equal(empty.recommendedStockOrder, oneDayStockCost('BUFE'));
  assert.ok(empty.recommendedStockOrder <= 15_000, 'erken oyunda gerçekçi ölçek');
});

// ---------------------------------------------------------------------------
// 2. Eşikler
// ---------------------------------------------------------------------------
test('2a) Eşik fonksiyonu: 14 yeşil, 13 sarı, 7 sarı, 6 kırmızı; stok parası yoksa her gün sayısında kritik', () => {
  assert.equal(UPGRADE_RESERVE_GREEN_DAYS, 14);
  assert.equal(UPGRADE_RESERVE_YELLOW_DAYS, 7);
  assert.equal(upgradeReserveLevel(999, true), 'GREEN');
  assert.equal(upgradeReserveLevel(14, true), 'GREEN');
  assert.equal(upgradeReserveLevel(13, true), 'YELLOW');
  assert.equal(upgradeReserveLevel(7, true), 'YELLOW');
  assert.equal(upgradeReserveLevel(6, true), 'RED');
  assert.equal(upgradeReserveLevel(0, true), 'RED');
  for (const d of [0, 6, 7, 13, 14, 500]) assert.equal(upgradeReserveLevel(d, false), 'CRITICAL', `${d} gün, stok yok`);
});

test('2b) Gerçek dükkânda dört seviye de doğru çıkar (kalan nakit ayarlanarak)', () => {
  const { eng, shop } = openBufe();
  shop.staffCount = 10; // günlük gider büyüsün: sarı/kırmızı bölgesi stok tutarının üstünde kalsın
  const base = assessUpgradeCash(eng.getState(), shop.shopId, 'tabela', 0)!;
  const D = base.dailyRent + base.dailyWages;
  const S = base.recommendedStockOrder;
  assert.ok(3 * D > S, 'kırmızı bölge stok tutarının üstünde (senaryo geçerli)');

  const cases: Array<[string, number, string]> = [
    ['yeşil (tam 14 gün)', 14 * D, 'GREEN'],
    ['yeşil (çok nakit)', 40 * D, 'GREEN'],
    ['sarı (13 gün)', 13 * D + 1, 'YELLOW'],
    ['sarı (7 gün)', 7 * D, 'YELLOW'],
    ['kırmızı (6 gün)', 7 * D - 1, 'RED'],
    ['kırmızı (3 gün)', 3 * D, 'RED'],
    ['kritik (stok parası 1 ₺ eksik)', S - 1, 'CRITICAL'],
    ['kritik (nakit 0)', 0, 'CRITICAL'],
  ];
  for (const [label, target, expected] of cases) {
    setCashAfter(eng, shop, 'tabela', target);
    const a = assessUpgradeCash(eng.getState(), shop.shopId, 'tabela', 0)!;
    assert.equal(a.cashAfter, r2(target), label);
    assert.equal(a.level, expected, `${label}: gün ${a.coverageDays}, stok ${a.stockRefillPossible}`);
  }
});

test('2c) Kritik, kalan nakit stok siparişinin 1 ₺ altındayken başlar; tam eşitken stok yenilenebilir', () => {
  const { eng, shop } = openBufe();
  const S = assessUpgradeCash(eng.getState(), shop.shopId, 'tabela', 0)!.recommendedStockOrder;
  setCashAfter(eng, shop, 'tabela', S);
  assert.equal(assessUpgradeCash(eng.getState(), shop.shopId, 'tabela', 0)!.stockRefillPossible, true);
  setCashAfter(eng, shop, 'tabela', S - 1);
  const a = assessUpgradeCash(eng.getState(), shop.shopId, 'tabela', 0)!;
  assert.equal(a.stockRefillPossible, false);
  assert.equal(a.level, 'CRITICAL');
});

// ---------------------------------------------------------------------------
// 3. Engel yok
// ---------------------------------------------------------------------------
test('3) Rezervin altında (kırmızı ve kritik) da yükseltme ALINIR: nakit tam maliyet kadar düşer, uyarı mesajda', () => {
  for (const target of ['red', 'critical'] as const) {
    const { eng, shop } = openBufe();
    shop.staffCount = 10;
    const base = assessUpgradeCash(eng.getState(), shop.shopId, 'tabela', 0)!;
    const D = base.dailyRent + base.dailyWages;
    setCashAfter(eng, shop, 'tabela', target === 'red' ? 3 * D : Math.max(0, base.recommendedStockOrder - 1));
    const before = totalCash(eng, shop);
    const pre = eng.getUpgradeCashAssessment(shop.shopId, 'tabela')!;
    assert.equal(pre.belowReserve, true, `${target}: rezervin altında`);
    assert.equal(pre.level, target === 'red' ? 'RED' : 'CRITICAL');

    const res = eng.buyShopUpgrade(shop.shopId, 'tabela');
    assert.equal(res.success, true, `${target}: alım engellenmemeli (${res.message})`);
    assert.ok((eng.getState().tradeState!.shops[0].upgrades ?? []).includes('tabela'), 'yükseltme gerçekten kuruldu');
    assert.equal(r2(before - totalCash(eng, eng.getState().tradeState!.shops[0])), pre.cost, 'nakit tam maliyet kadar düştü');
    assert.ok(res.message.includes('DİKKAT'), `${target}: güçlü uyarı mesajda`);
    assert.equal(res.assessment?.level, pre.level, 'sonuç, alımdan ÖNCEKİ nakitle hesaplanmış değerlendirmeyi taşır');
  }
});

test('3b) Rezervin üstündeyken uyarı yoktur ve alım eskisi gibi çalışır', () => {
  const { eng, shop } = openBufe();
  const pre = eng.getUpgradeCashAssessment(shop.shopId, 'tabela')!;
  assert.equal(pre.belowReserve, false);
  assert.equal(pre.level, 'GREEN');
  assert.equal(pre.warningTR, '');
  const res = eng.buyShopUpgrade(shop.shopId, 'tabela');
  assert.equal(res.success, true);
  assert.ok(!res.message.includes('DİKKAT'));
});

// ---------------------------------------------------------------------------
// 4. Uyarı metni
// ---------------------------------------------------------------------------
test('4) Uyarı; kalan nakdi, önerilen rezervi ve 7 günlük gider tahminini yazar', () => {
  const { eng, shop } = openBufe();
  shop.staffCount = 4;
  setCashAfter(eng, shop, 'tabela', 556);
  const a = eng.getUpgradeCashAssessment(shop.shopId, 'tabela')!;
  assert.equal(a.belowReserve, true);
  assert.equal(a.cashAfter, 556);
  assert.ok(a.warningTR.includes(tl(556)), `kalan nakit yazılı: ${a.warningTR}`);
  assert.ok(a.warningTR.includes(tl(a.upgradeSafetyReserve)), 'önerilen rezerv yazılı');
  assert.ok(a.warningTR.includes(tl(a.nextSevenDaysExpenses)), '7 günlük gider tahmini yazılı');
  assert.ok(a.warningTR.includes('stok yenilemeye para kalmıyor'), 'kritikse bunu da söyler');
  const res = eng.buyShopUpgrade(shop.shopId, 'tabela');
  assert.ok(res.message.includes(a.warningTR), 'alım mesajı aynı uyarıyı taşır');
});

// ---------------------------------------------------------------------------
// 5. Reddedilen alım ve rezerve nakit
// ---------------------------------------------------------------------------
test('5a) Nakdi yükseltmeye bile yetmiyorsa alım eskisi gibi reddedilir (bu uyarı değil, gerçek yetersizlik)', () => {
  const { eng, shop } = openBufe();
  const cost = assessUpgradeCash(eng.getState(), shop.shopId, 'tabela', 0)!.cost;
  WalletEngine.setBalance(eng.getState(), 0);
  eng.getState().investmentCash = 0;
  shop.cashAccountBalance = cost - 1;
  const a = eng.getUpgradeCashAssessment(shop.shopId, 'tabela')!;
  assert.equal(a.affordable, false);
  assert.equal(a.cashAfter, -1);
  assert.equal(a.coverageDays, 0);
  const before = totalCash(eng, shop);
  const res = eng.buyShopUpgrade(shop.shopId, 'tabela');
  assert.equal(res.success, false);
  assert.equal(totalCash(eng, shop), before, 'hiçbir şey değişmedi');
  assert.equal(res.assessment, undefined);
});

test('5b) Rezerve emir nakdi kalan nakde sayılmaz', () => {
  const { eng, shop } = openBufe();
  const state = eng.getState();
  const free = assessUpgradeCash(state, shop.shopId, 'tabela', 0)!;
  const reserved = 200_000;
  const held = assessUpgradeCash(state, shop.shopId, 'tabela', reserved)!;
  assert.equal(r2(free.cashBefore - held.cashBefore), reserved);
  assert.equal(r2(free.cashAfter - held.cashAfter), reserved);
});

test('5c) Dükkân, yükseltme yoksa ya da şube ise değerlendirme null döner', () => {
  const { eng, shop } = openBufe();
  const state = eng.getState();
  assert.equal(assessUpgradeCash(state, 'YOK', 'tabela', 0), null);
  assert.equal(assessUpgradeCash(state, shop.shopId, 'yok-boyle-bir-sey', 0), null);
  shop.isCompanyBranch = true;
  assert.equal(assessUpgradeCash(state, shop.shopId, 'tabela', 0), null);
});

// ---------------------------------------------------------------------------
// 6. Arayüz
// ---------------------------------------------------------------------------
const noop = () => {};
function renderUpgradeScreen(eng: SimulationEngine): string {
  return renderToStaticMarkup(
    React.createElement(EsnafAndTradePanel, {
      state: eng.getState(),
      spendableCash: eng.getSpendableCash(),
      formatCurrency: (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`,
      initialActionTab: 'UPGRADE_SHOP',
      onOpenShop: noop,
      onUpgradeShopLevel: noop,
      onBuyShopUpgrade: noop,
      onTransferShopCash: noop,
      onConfigureShop: noop,
      onPlaceProcurementOrder: noop,
      onCancelProcurementOrder: noop,
      onCreatePurchaseContract: noop,
      onExecuteRecipeProduction: noop,
      onPurchaseLogisticsVehicle: noop,
      onDispatchWarehouseToShop: noop,
      onAcceptCommercialContract: noop,
      onDeliverCommercialContract: noop,
      onIncorporateShopsIntoCompany: noop,
      onHireFirstEmployee: noop,
    } as never)
  );
}

test('6) Arayüz: her alınabilir yükseltmede renkli eşik rozeti görünür; uyarı kartı dokunmadan önce görünmez', () => {
  const { eng, shop } = openBufe();
  shop.staffCount = 10;
  const base = assessUpgradeCash(eng.getState(), shop.shopId, 'tabela', 0)!;
  const D = base.dailyRent + base.dailyWages;

  const expectations: Array<[number, string, string]> = [
    [20 * D, 'GREEN', 'Yeşil'],
    [10 * D, 'YELLOW', 'Sarı'],
    [3 * D, 'RED', 'Kırmızı'],
    [Math.max(0, base.recommendedStockOrder - 1), 'CRITICAL', 'Kritik'],
  ];
  for (const [target, level, word] of expectations) {
    setCashAfter(eng, shop, 'tabela', target);
    const html = renderUpgradeScreen(eng);
    const tier = html.match(/<span data-testid="shop-small-upgrade-tier-tabela" data-level="(\w+)"[^>]*>([^<]*)<\/span>/);
    assert.ok(tier, `${level}: rozet çizildi`);
    assert.equal(tier[1], level);
    assert.ok(tier[2].startsWith(word), `rozet yazısı "${tier[2]}" "${word}" ile başlamalı`);
    assert.ok(!html.includes('data-testid="shop-upgrade-reserve-warning-tabela"'), 'uyarı kartı ilk dokunuştan önce yok');
    assert.ok(html.includes('data-testid="shop-small-upgrade-buy-tabela"'), 'satın alma düğmesi her seviyede var');
  }
  // Kilitli yükseltmede rozet yok
  assert.ok(!renderUpgradeScreen(eng).includes('shop-small-upgrade-tier-kasa'), '2. seviye ister: rozet çizilmez');
});
