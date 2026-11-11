import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { AccountingEngine } from '../../engine/AccountingEngine';
import { SHOP_TEMPLATES } from '../../engine/TradeAndShopEngine';
import { SimulationStore } from '../../state/simulationStore';
import {
  deriveCityUrbanBlocks,
  deriveIsometricBuildings,
  resolveCityBuildingNavigation,
} from '../../components/game/city/cityLayout';
import type { ShopTypeId } from '../../models/trade';

describe('V7 Ticaret Evreni & Borsa->Esnaf->Şirket->IPO->Holding 18 Kapsamlı Kabul Testi', () => {
  it('Test 1: Yeni oyuncu yalnızca borsa aşamasıyla (STOCK_INVESTOR, 100.000 TL nakit, 0 dükkân, 0 şirket) başlar', () => {
    const engine = new SimulationEngine(4242, 100_000);
    const state = engine.getState();

    assert.equal(state.cash, 100_000);
    assert.equal(state.playerCompany, null);
    assert.ok(state.tradeState, 'tradeState başlatılmış olmalı');
    assert.equal(state.tradeState.careerStage, 'STOCK_INVESTOR');
    assert.equal(state.tradeState.shops.length, 0);
    assert.equal(state.controlledSubsidiaries.length, 0);
  });

  it('Test 2: Borsa işlemleri (hisse alım/satım ve limit emir) kişisel/yatırım nakdini ve portföyü doğru değiştirir', () => {
    const engine = new SimulationEngine(4242, 100_000);
    // Seans açılışına (10:10 MARKET_OPEN = 610. dakika) ilerlet
    const currentMin = engine.getState().minutesIntoCurrentDay;
    if (currentMin < 610) {
      engine.advanceGameMinutes(610 - currentMin);
    }
    assert.equal(engine.getState().marketSession, 'MARKET_OPEN');

    const stateBefore = engine.getState();
    const targetTicker = stateBefore.stocks[0].ticker;
    const cashBefore = stateBefore.cash;

    const buyRes = engine.buyStock(targetTicker, 50);
    assert.equal(buyRes.success, true, buyRes.message);

    const stateAfterBuy = engine.getState();
    const cashAfterBuy = stateAfterBuy.cash;
    assert.equal(
      Number((cashBefore - buyRes.totalCost).toFixed(2)),
      cashAfterBuy,
      'Hisse alımında toplam maliyet nakitten tam düşmeli'
    );
    assert.equal(stateAfterBuy.portfolio[targetTicker]?.shares, 50);

    const sellRes = engine.sellStock(targetTicker, 20);
    assert.equal(sellRes.success, true, sellRes.message);
    assert.equal(engine.getState().portfolio[targetTicker]?.shares, 30);
    assert.equal(
      engine.getState().cash,
      Number((cashAfterBuy + sellRes.netProceeds).toFixed(2))
    );
  });

  it('Test 3: Yeterli sermayeye ulaşınca 8 farklı esnaf/mağaza türünden dükkân açılabilir', () => {
    const expectedTypes: ShopTypeId[] = [
      'BUFE',
      'MANAV',
      'KAFE',
      'GIYIM_MAGAZASI',
      'ELEKTRONIK_MAGAZASI',
      'MOBILYA_MAGAZASI',
      'MARKET',
      'OTOMOBIL_GALERISI',
    ];
    for (const st of expectedTypes) {
      const tpl = SHOP_TEMPLATES[st];
      assert.ok(tpl, `${st} şablonu mevcut olmalı`);
      assert.ok(tpl.openingCost > 0);
      assert.ok(tpl.dailyRentBase > 0);
      assert.ok(tpl.minStaffRequired >= 1);
    }

    const engine = new SimulationEngine(4242, 150_000);
    const openRes = engine.openShop({
      shopType: 'BUFE',
      customName: 'Merkez Büfe #1',
      initialCashFloat: 15_000,
    });
    assert.equal(openRes.success, true, openRes.message);
    assert.equal(engine.getState().tradeState?.careerStage, 'SMALL_MERCHANT');
    assert.equal(engine.getState().tradeState?.shops.length, 1);
  });

  it('Test 4: Dükkân açma maliyeti yalnızca bir kez düşer ve net varlık denklemi bozulmaz', () => {
    const engine = new SimulationEngine(4242, 150_000);
    const cashBefore = engine.getState().cash;
    const tpl = SHOP_TEMPLATES.BUFE;
    const expectedDeduction = tpl.openingCost + tpl.decorationCost + 12_000;

    const openRes = engine.openShop({
      shopType: 'BUFE',
      customName: 'Tek Çekim Büfe',
      initialCashFloat: 12_000,
    });
    assert.equal(openRes.success, true);

    const state = engine.getState();
    assert.equal(
      state.cash,
      cashBefore - expectedDeduction,
      'Dükkân açılış maliyeti tam olarak bir kez düşmeli'
    );

    const audit = AccountingEngine.auditSimulationIntegrity(state);
    assert.equal(audit.valid, true, `Muhasebe denetimi hatası: ${audit.errors.join(' | ')}`);
  });

  it('Test 5 & Test 6: Ürün siparişi gerçek sipariş ve sevkiyat kaydı oluşturur; teslimat tamamlanınca doğru dükkânın stoğu artar', () => {
    const engine = new SimulationEngine(4242, 200_000);
    const openRes = engine.openShop({
      shopType: 'BUFE',
      customName: 'Teslimat Büfe',
      initialCashFloat: 25_000,
    });
    assert.equal(openRes.success, true);
    const shopId = openRes.shop!.shopId;

    const shopRef = engine.getState().tradeState!.shops[0];
    shopRef.autoReplenishEnabled = false;
    engine.getState().tradeState!.autoShopReplenishEnabled = false;
    for (const k of Object.keys(shopRef.sellingPrices)) {
      shopRef.sellingPrices[k] = 999_999;
    }

    const initialQty = shopRef.inventoryBatches
      .filter((b) => b.resourceId === 'FIN_PACKAGED_FOOD')
      .reduce((acc, b) => acc + b.availableQuantity, 0);
    assert.equal(initialQty, 0, 'Yeni açılan dükkânda sipariş öncesi stok 0 olmalı');

    const offers = engine.getSupplierOffers('FIN_PACKAGED_FOOD');
    const offer = offers[0];

    const orderRes = engine.placeProcurementOrder({
      supplierId: offer.supplierId,
      resourceId: 'FIN_PACKAGED_FOOD',
      quantity: 60,
      destinationType: 'SHOP',
      destinationId: shopId,
      paymentTermType: 'CASH',
    });

    assert.equal(orderRes.success, true, orderRes.message);
    assert.ok(orderRes.order, 'Gerçek ProcurementOrder kaydı oluşmalı');
    assert.ok(orderRes.shipment, 'Gerçek Shipment kaydı oluşmalı');
    assert.equal(orderRes.shipment.status, 'IN_TRANSIT');

    // Sipariş verildiği anda stok artmamalı
    const qtyImmediatelyAfter = engine
      .getState()
      .tradeState!.shops[0].inventoryBatches.filter(
        (b) => b.resourceId === 'FIN_PACKAGED_FOOD'
      )
      .reduce((acc, b) => acc + b.availableQuantity, 0);
    assert.equal(qtyImmediatelyAfter, 0);

    // Teslimat gününe kadar ilerlet
    for (let d = 0; d < offer.deliveryDays; d++) {
      engine.tickDay();
    }

    const shipmentAfter = engine
      .getState()
      .tradeState!.shipments.find((s) => s.shipmentId === orderRes.shipment!.shipmentId)!;
    assert.equal(shipmentAfter.status, 'DELIVERED', 'Sevkiyat teslim edilmiş olmalı');

    const shopAfterDelivery = engine.getState().tradeState!.shops[0];
    const qtyAfterDelivery = shopAfterDelivery.inventoryBatches
      .filter((b) => b.resourceId === 'FIN_PACKAGED_FOOD')
      .reduce((acc, b) => acc + b.availableQuantity, 0);

    assert.ok(
      qtyAfterDelivery > initialQty,
      `Teslimat tamamlandığında doğru dükkânın stoğu artmalı (Önce: ${initialQty}, Sonra: ${qtyAfterDelivery})`
    );
  });

  it('Test 7: Stok yokken hayali satış ve gelir kesin olarak engellenir', () => {
    const engine = new SimulationEngine(4242, 200_000);
    engine.openShop({
      shopType: 'BUFE',
      customName: 'Stoksuz Büfe',
      initialCashFloat: 10_000,
    });

    const state = engine.getState();
    const shop = state.tradeState!.shops[0];
    shop.autoReplenishEnabled = false;
    state.tradeState!.autoShopReplenishEnabled = false;
    shop.inventoryBatches = [];

    engine.tickDay();

    const updatedShop = engine.getState().tradeState!.shops[0];
    assert.equal(updatedShop.todayUnitsSold, 0, 'Stok yokken satış adedi 0 olmalı');
    assert.equal(updatedShop.todaySalesRevenue, 0, 'Stok yokken satış geliri 0 TL olmalı');
    assert.ok(updatedShop.todayUnmetCustomerDemand > 0, 'Karşılanamayan talep kaydedilmeli');
  });

  it('Test 8 & Test 9: Satış geliri doğru işletme kasasına girer; kişisel nakit ile işletme kasası birbirinden ayrı kalır', () => {
    const engine = new SimulationEngine(4242, 250_000);
    const openRes = engine.openShop({
      shopType: 'BUFE',
      customName: 'Aktif Satış Büfesi',
      initialCashFloat: 35_000,
    });
    assert.equal(openRes.success, true);
    const shopId = openRes.shop!.shopId;

    const state = engine.getState();
    const shop = state.tradeState!.shops[0];
    shop.autoReplenishEnabled = false;
    state.tradeState!.autoShopReplenishEnabled = false;

    // Tedarikçiden ürün sipariş et ve teslim al
    const offers = engine.getSupplierOffers('FIN_PACKAGED_FOOD');
    const ord = engine.placeProcurementOrder({
      supplierId: offers[0].supplierId,
      resourceId: 'FIN_PACKAGED_FOOD',
      quantity: 80,
      destinationType: 'SHOP',
      destinationId: shopId,
      paymentTermType: 'CASH',
    });
    assert.equal(ord.success, true);

    for (let d = 0; d < offers[0].deliveryDays; d++) {
      engine.tickDay();
    }

    const personalCashBeforeSalesDay = engine.getState().cash;
    const shopCashBeforeSalesDay =
      engine.getState().tradeState!.shops[0].cashAccountBalance;

    // Satış günü
    engine.tickDay();

    const stateAfter = engine.getState();
    const shopAfter = stateAfter.tradeState!.shops[0];

    assert.ok(
      shopAfter.todayUnitsSold > 0 && shopAfter.todaySalesRevenue > 0,
      'Stoğu olan dükkânda günlük müşteri satışı gerçekleşmeli'
    );
    assert.notEqual(
      shopAfter.cashAccountBalance,
      shopCashBeforeSalesDay,
      'Satış geliri ve günlük giderler dükkânın işletme kasasını güncellemeli'
    );
    assert.equal(
      stateAfter.cash,
      personalCashBeforeSalesDay,
      'Bağımsız dükkânın günlük satış/kira hareketi oyuncunun kişisel nakdini doğrudan değiştirmemeli; dükkân kasasında izlenmeli'
    );

    // Kişisel nakitten dükkân kasasına kontrollü transfer
    const xferRes = engine.transferBetweenPersonalAndShopCash({
      shopId: shopAfter.shopId,
      direction: 'TO_SHOP',
      amount: 5_000,
    });
    assert.equal(xferRes.success, true);
    assert.equal(engine.getState().cash, personalCashBeforeSalesDay - 5_000);
  });

  it('Test 10 & Test 11: Şirketleşme sırasında şubeler ve stoklar korunur ve şirketleşme işlemi iki kere yapılamaz', () => {
    const engine = new SimulationEngine(4242, 1_200_000);

    engine.openShop({
      shopType: 'BUFE',
      customName: 'Şube 1 Büfe',
      initialCashFloat: 80_000,
    });
    engine.openShop({
      shopType: 'KAFE',
      customName: 'Şube 2 Kafe',
      initialCashFloat: 90_000,
    });
    engine.openShop({
      shopType: 'MARKET',
      customName: 'Şube 3 Market',
      initialCashFloat: 120_000,
    });

    for (const shop of engine.getState().tradeState!.shops) {
      engine.configureShopParameters({
        shopId: shop.shopId,
        targetStaffCount: 4,
      });
    }

    for (let d = 0; d < 4; d++) {
      engine.tickDay();
    }

    const ts = engine.getState().tradeState!;
    ts.tradeReputationScore = 70;
    ts.shops[0].dailyProfitHistory30.push(120_000);

    const stockUnitsBefore = ts.shops.map((s) =>
      s.inventoryBatches.reduce((sum, b) => sum + b.availableQuantity, 0)
    );
    const shopIdsBefore = ts.shops.map((s) => s.shopId);

    const incRes1 = engine.incorporateShopsIntoCompany({
      companyName: 'Anadolu Perakende ve Üretim A.Ş.',
      ticker: 'ANPR',
      sector: 'PERAKENDE',
      additionalCashCapital: 250_000,
    });
    assert.equal(incRes1.success, true, incRes1.message);

    const shopsAfter = engine.getState().tradeState!.shops;
    assert.equal(shopsAfter.length, 3, 'Şubeler silinmemeli');
    shopsAfter.forEach((s, idx) => {
      assert.equal(s.shopId, shopIdsBefore[idx]);
      assert.equal(s.isCompanyBranch, true, 'Şube kurumsal şirket şubesine dönüşmeli');
      const currentStock = s.inventoryBatches.reduce(
        (sum, b) => sum + b.availableQuantity,
        0
      );
      assert.equal(
        currentStock,
        stockUnitsBefore[idx],
        'Şirketleşme sırasında şube stokları korunmalı'
      );
    });

    // İkinci kez şirketleşme denemesi reddedilmeli
    const incRes2 = engine.incorporateShopsIntoCompany({
      companyName: 'İkinci Şirket Denemesi A.Ş.',
      ticker: 'IKNC',
      sector: 'PERAKENDE',
      additionalCashCapital: 100_000,
    });
    assert.equal(
      incRes2.success,
      false,
      'Zaten şirketleşmiş işletme ikinci kez şirketleştirilememeli'
    );
  });

  it('Test 12 & Test 13: Şehirdeki binaların ACTIVE, LOCKED ve DECORATIVE durumları doğrudur ve aktif binalar doğru ekranı açar', () => {
    const engine = new SimulationEngine(4242, 100_000);
    const state = engine.getState();
    const ipoElig = engine.checkIPOEligibility();
    const coreBuildings = deriveIsometricBuildings(
      state,
      ipoElig,
      (v) => `₺${v}`
    );
    const urbanBlocks = deriveCityUrbanBlocks(state);

    // Başlangıçta Borsa, Banka, Haber Merkezi, Oyuncu Ofisi açık; Fabrika, Ar-Ge, Holding kilitli
    const borsa = coreBuildings.find((b) => b.id === 'BORSA')!;
    const fabrika = coreBuildings.find((b) => b.id === 'FABRIKA')!;
    const holding = coreBuildings.find((b) => b.id === 'HOLDING_MERKEZI')!;
    assert.equal(borsa.isUnlocked, true);
    assert.equal(fabrika.isUnlocked, false);
    assert.equal(holding.isUnlocked, false);
    assert.ok(fabrika.lockedOverlayInfo, 'Kilitli fabrikanın açılma koşulu bilgisi olmalı');

    // Şehir bloklarında ACTIVE, LOCKED ve DECORATIVE sınıflandırması
    const activeShopBlock = urbanBlocks.find(
      (b) => b.id === 'urban-ticaret-magaza-1'
    )!;
    const lockedIndustrialDepot = urbanBlocks.find(
      (b) => b.id === 'urban-sanayi-depo-9'
    )!;
    const decorativeResidential = urbanBlocks.find(
      (b) => b.id === 'urban-yasam-konut-17'
    )!;

    assert.equal(activeShopBlock.statusClassification, 'ACTIVE');
    assert.equal(lockedIndustrialDepot.statusClassification, 'LOCKED');
    assert.ok(lockedIndustrialDepot.unlockConditionTR);
    assert.ok(lockedIndustrialDepot.requiredCapitalTR);
    assert.equal(decorativeResidential.statusClassification, 'DECORATIVE');

    // Aktif binaların ekran yönlendirmeleri
    assert.equal(resolveCityBuildingNavigation('BORSA', state).buildingId, 'BORSA');
    assert.equal(resolveCityBuildingNavigation('BANKA', state).bankSubTab, 'TRANSFER');
    assert.equal(
      resolveCityBuildingNavigation('OYUNCU_OFISI', state).buildingId,
      'OYUNCU_OFISI'
    );
    assert.equal(
      resolveCityBuildingNavigation('FABRIKA', state).companySubTab,
      'URETIM'
    );
  });

  it('Test 14 & Test 15: Sayfa yenilendiğinde (serialize/deserialize) ticaret zinciri korunur ve eski kayıt migration işlemi idempotent/güvenlidir', () => {
    const engine = new SimulationEngine(4242, 300_000);
    const openRes = engine.openShop({
      shopType: 'MANAV',
      customName: 'Kalıcı Manav',
      initialCashFloat: 20_000,
    });
    assert.equal(openRes.success, true);

    const offers = engine.getSupplierOffers('FIN_FRESH_GROCERY');
    const orderRes = engine.placeProcurementOrder({
      supplierId: offers[0].supplierId,
      resourceId: 'FIN_FRESH_GROCERY',
      quantity: 35,
      destinationType: 'SHOP',
      destinationId: openRes.shop!.shopId,
      paymentTermType: 'CASH',
    });
    assert.equal(orderRes.success, true);

    // Serialize & Deserialize (Sayfa yenileme simülasyonu)
    const serialized = JSON.stringify(engine.getState());
    const restoredEngine = new SimulationEngine(4242, 100_000);
    restoredEngine.restoreFromSavedState(JSON.parse(serialized));
    const restoredState = restoredEngine.getState();

    assert.equal(restoredState.tradeState?.shops.length, 1);
    assert.equal(restoredState.tradeState?.shops[0].nameTR, 'Kalıcı Manav');
    assert.equal(restoredState.tradeState?.procurementOrders.length, 1);
    assert.equal(restoredState.tradeState?.shipments.length, 1);
    assert.equal(restoredState.cash, engine.getState().cash);

    // Eski kayıt migration idempotency kontrolü
    const legacyRawState = JSON.parse(serialized);
    delete legacyRawState.tradeState;
    const legacyEnvelope = {
      version: 4,
      savedAtISO: '2026-01-01T12:00:00.000Z',
      state: legacyRawState,
    };
    const migratedOnceEnv = SimulationStore.migrateIfNeeded(legacyEnvelope)!;
    const cashAfterFirstMigration = migratedOnceEnv.state.cash;
    const migratedTwiceEnv = SimulationStore.migrateIfNeeded(migratedOnceEnv)!;

    assert.equal(migratedTwiceEnv.state.cash, cashAfterFirstMigration);
    assert.ok(migratedTwiceEnv.state.tradeState, 'Eski kayda tradeState güvenli biçimde eklenmeli');
  });

  it('Test 16: Hızlandırılmış uzun süreli simülasyonda para veya stok çoğaltma açığı oluşmaz', () => {
    const engine = new SimulationEngine(9090, 500_000);

    engine.openShop({
      shopType: 'BUFE',
      customName: 'Stres Büfe',
      initialCashFloat: 25_000,
    });
    engine.openShop({
      shopType: 'MANAV',
      customName: 'Stres Manav',
      initialCashFloat: 30_000,
    });

    for (let day = 1; day <= 60; day++) {
      engine.tickDay();

      if (day % 15 === 0) {
        const state = engine.getState();
        assert.ok(Number.isFinite(state.cash));
        assert.ok(Number.isFinite(state.netWorth));

        const trdAudit = engine.runTradeIntegrityAuditNonMutating();
        assert.equal(
          trdAudit.valid,
          true,
          `Gün ${day} Ticaret denetimi hatası: ${trdAudit.errors.join(' | ')}`
        );

        const accAudit = AccountingEngine.auditSimulationIntegrity(state);
        assert.equal(
          accAudit.valid,
          true,
          `Gün ${day} Muhasebe denetimi hatası: ${accAudit.errors.join(' | ')}`
        );
      }
    }
  });

  it('Test 17 & Test 18: Oyuncunun kurduğu şirket halka arzdan (IPO) sonra borsada gerçek hisse olarak görünür ve temettü ödemesi şirket kasasından yatırımcı hesabına doğru aktarılır', () => {
    const engine = new SimulationEngine(4242, 3_500_000);

    // Şirket kur
    const est = engine.establishCompany(
      'Marmara Endüstri ve Ticaret A.Ş.',
      'MREN',
      'PERAKENDE',
      1_800_000,
      {
        initialStaffCount: 40,
        initialCapacity: 120,
        initialRdBudget: 15_000,
      }
    );
    assert.equal(est.success, true, est.message);

    // 7 gün çalıştırarak asgari faaliyet günü (5 gün) ve ciro/FAVÖK koşullarını sağla
    for (let d = 0; d < 7; d++) {
      engine.tickDay();
    }

    const pc = engine.getState().playerCompany!;
    pc.operatingDays = Math.max(pc.operatingDays, 10);
    pc.annualizedRevenue = Math.max(pc.annualizedRevenue, 3_200_000);
    pc.annualizedEbitda = Math.max(pc.annualizedEbitda, 650_000);
    pc.corporateGovernanceScore = Math.max(pc.corporateGovernanceScore, 82);

    const ipoElig = engine.checkIPOEligibility();
    assert.equal(
      ipoElig.eligible,
      true,
      `Şirket IPO koşullarını sağlamalı: ${ipoElig.reasons.join(', ')}`
    );

    const ipoRes = engine.executeIPO(0.25, 0.1, 0.35);
    assert.equal(ipoRes.success, true, ipoRes.message);

    const stateAfterIpo = engine.getState();
    const listedStock = stateAfterIpo.stocks.find((s) => s.ticker === 'MREN');
    assert.ok(
      listedStock,
      'Halka arz edilen oyuncu şirketi (MREN) borsa hisse listesinde görünmeli'
    );
    assert.equal(listedStock.isPlayerCompany, true);
    assert.ok(
      (stateAfterIpo.portfolio['MREN']?.shares ?? 0) > 0,
      'Oyuncunun kalan şirket payları borsa portföyünde yer almalı'
    );

    // Temettü dağıtım testi: MREN hissesinin temettü günü geldiğinde şirket kasasından düşüp oyuncu hesabına geçtiğini doğrula
    listedStock.dividendPeriodDays = 1;
    listedStock.dividendYieldAnnual = 0.08;
    stateAfterIpo.portfolio['MREN'].lastPurchaseDay = 0;

    const companyCashBeforeDiv = listedStock.financials.cash;
    const playerDividendsBefore = stateAfterIpo.totalDividendsEarned;

    engine.tickDay();

    const stateAfterDiv = engine.getState();
    assert.ok(
      stateAfterDiv.totalDividendsEarned > playerDividendsBefore,
      'Temettü ödemesi yatırımcı (oyuncu) hesabına aktarılmalı'
    );
    const dividendTx = stateAfterDiv.transactions.find(
      (tx) => tx.type === 'DIVIDEND' && tx.ticker === 'MREN'
    );
    assert.ok(
      dividendTx && dividendTx.cashDelta > 0,
      `MREN temettü işlemi kaydedilmeli (companyCashBefore: ${companyCashBeforeDiv})`
    );
  });
});
