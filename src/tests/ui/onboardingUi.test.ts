/**
 * Arayüz kalabalığı ve ilk oyuncu deneyimi (plan Bölüm 4): aşamalı menü, kilitli sekme, dükkân rozeti,
 * kayıttaki onboarding, görev tabanlı rehber, pencere koordinasyonu.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import {
  defaultOnboarding,
  migrateOnboarding,
  navTabStatuses,
  restartedOnboarding,
  shopTabIndicators,
  withCompletedStep,
} from '../../engine/OnboardingRules';
import { GameBottomNavigation } from '../../components/game/GameBottomNavigation';
import { GameTopBar } from '../../components/game/GameTopBar';
import { GUIDE_STEPS, currentGuideStep } from '../../components/game/FirstRunGuide';
import { ALL_OVERLAYS, overlaysToClose, welcomeGuideMayShow, type OverlayFlags } from '../../components/game/ui/overlayCoordinator';

function passGate(eng: SimulationEngine): void {
  const stocks = eng.getState().stocks;
  const a = stocks[0];
  const b = stocks.find((s) => s.sector !== a.sector)!;
  assert.equal(eng.buyStock(a.ticker, 10).success, true);
  assert.equal(eng.buyStock(b.ticker, 10).success, true);
  assert.equal(eng.sellStock(a.ticker, 5).success, true);
  eng.advanceDaysWithoutPlayerDecisions(1, true);
}

function renderTop(eng: SimulationEngine): string {
  const st = eng.getState();
  return renderToStaticMarkup(
    React.createElement(GameTopBar, {
      day: st.day,
      dateISO: st.dateISO,
      formattedTime: '00:00',
      marketSession: st.marketSession,
      cash: st.cash,
      netWorth: st.netWorth,
      unreadNotificationsCount: 0,
      onOpenNotifications: () => {},
      onOpenSettings: () => {},
      onSwitchToDeveloperDashboard: () => {},
      formatCurrency: (v: number) => String(v),
      newsVisible: navTabStatuses(st).news.mode !== 'hidden',
      onOpenNews: () => {},
      onOpenGuide: () => {},
      timeScale: st.timeScale,
      onSetTimeScale: () => {},
    })
  );
}

function renderNav(eng: SimulationEngine): string {
  const st = eng.getState();
  return renderToStaticMarkup(
    React.createElement(GameBottomNavigation, {
      activeTab: 'city',
      onSelectTab: () => {},
      openOrdersCount: 0,
      tabStatuses: navTabStatuses(st),
      shopIndicators: shopTabIndicators(st),
      hasPlayerCompany: st.playerCompany !== null,
      onOpenGuide: () => {},
    })
  );
}

test('Yeni oyuncu ilk ekranda en çok 3 menü hedefi görür (Harita, Borsa ve üst çubukta Rehber)', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  const html = renderNav(eng);
  for (const id of ['city', 'market']) assert.ok(html.includes(`bottom-nav-${id}"`), id);
  for (const id of ['portfolio', 'company', 'news', 'bank', 'guide']) assert.ok(!html.includes(`bottom-nav-${id}"`), `${id} alt menüde olmamalı`);
  // Rehber ve Haberler üst çubukta; Haberler yeni oyuncuda gizli
  const top = renderTop(eng);
  assert.ok(top.includes('data-testid="top-guide-btn"'));
  assert.ok(!top.includes('data-testid="top-news-btn"'));
  assert.equal(navTabStatuses(eng.getState()).company.mode, 'hidden');
});

test('Aşamalı açılış: ilk alımda Haberler, kapı bitince Dükkân, sonra Şirket kilitli önizleme', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  const a = eng.getState().stocks[0];
  assert.equal(eng.buyStock(a.ticker, 10).success, true);
  let s = navTabStatuses(eng.getState());
  assert.equal(s.news.mode, 'active');
  assert.equal(s.bank.mode, 'active', 'Banka ilk hisse alınınca açılır');
  assert.equal(s.portfolio.mode, 'locked');
  assert.ok(s.portfolio.hint && s.portfolio.hint.length > 5);
  assert.equal(s.company.mode, 'hidden');

  const eng2 = new SimulationEngine(20261104, 100_000);
  passGate(eng2);
  s = navTabStatuses(eng2.getState());
  assert.equal(s.portfolio.mode, 'active');
  assert.equal(s.company.mode, 'locked');
});

test('Kilitli sekme: gri/kilit simgesi, aria-disabled ve kısa açıklama; panel açılmaz', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  eng.buyStock(eng.getState().stocks[0].ticker, 10);
  const html = renderNav(eng);
  assert.ok(html.includes('data-testid="bottom-nav-portfolio"'));
  assert.ok(html.includes('aria-disabled="true"'));
  assert.ok(html.includes('bottom-nav-lock-portfolio'));
  assert.ok(html.includes('(kilitli)'));
});

test('Eski kayıt: dükkânı olan oyuncuda bütün sekmeler açık', () => {
  const eng = new SimulationEngine(20261104, 1_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const s = navTabStatuses(eng.getState());
  assert.equal(s.portfolio.mode, 'active');
  assert.equal(s.news.mode, 'active');
});

test('Dükkân rozeti hisse pozisyon sayısını DEĞİL, stoğu biten dükkân sayısını gösterir', () => {
  const eng = new SimulationEngine(20261104, 1_000_000);
  const stocks = eng.getState().stocks;
  eng.buyStock(stocks[0].ticker, 10);
  eng.buyStock(stocks[1].ticker, 10);
  eng.buyStock(stocks[2].ticker, 10);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const ind = shopTabIndicators(eng.getState());
  assert.equal(ind.ownedShopCount, 1);
  assert.equal(ind.emptyShopCount, 1, 'yeni dükkânın rafı boş');
  const html = renderNav(eng);
  // 3 hisse pozisyonu var; rozet 1 (boş dükkân) olmalı
  const m = html.match(/data-testid="bottom-nav-portfolio"[\s\S]*?<\/button>/);
  assert.ok(m);
  assert.ok(/>1<\/span>/.test(m![0]));
  assert.ok(!/>3<\/span>/.test(m![0]));
});

test('Onboarding kayıtta: yeni oyunda varsayılan, kayıt-yükleme korur, yeni kariyerde yeniden başlar', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  assert.deepEqual(eng.getState().onboarding, defaultOnboarding());
  eng.updateOnboarding({ type: 'complete', stepId: 'welcome' });
  eng.updateOnboarding({ type: 'marketUpdateSeen' });
  const loaded = SimulationEngine.deserializeState(eng.serializeState());
  const ob = loaded.getState().onboarding!;
  assert.deepEqual(ob.completedSteps, ['welcome']);
  assert.equal(ob.firstMarketUpdateSeen, true);
  assert.equal(ob.dismissed, false);
  // Yeni kariyer (yeni motor) aynı cihazda rehberi baştan çalıştırır
  const fresh = new SimulationEngine(777, 100_000);
  assert.deepEqual(fresh.getState().onboarding, defaultOnboarding());
});

test('Eski kayıt göçü: alan yoksa ilerlemiş oyuncuda rehber kapalı, 1. gün sıfır oyuncuda açık', () => {
  assert.equal(migrateOnboarding(undefined, { day: 1, hasProgress: false, legacyGuideDone: false }).dismissed, false);
  assert.equal(migrateOnboarding(undefined, { day: 9, hasProgress: false, legacyGuideDone: false }).dismissed, true);
  assert.equal(migrateOnboarding(undefined, { day: 1, hasProgress: true, legacyGuideDone: false }).dismissed, true);
  assert.equal(migrateOnboarding(undefined, { day: 1, hasProgress: false, legacyGuideDone: true }).dismissed, true);
  // Bozuk alan güvenle varsayılana düşer
  assert.equal(migrateOnboarding({ version: 1 }, { day: 1, hasProgress: false, legacyGuideDone: false }).version, 2);
  const eng = new SimulationEngine(20261104, 100_000);
  const raw = JSON.parse(eng.serializeState());
  delete raw.onboarding;
  raw.day = 12;
  const loaded = SimulationEngine.deserializeState(JSON.stringify(raw));
  assert.equal(loaded.getState().onboarding?.dismissed, true);
});

test('Rehber: adımlar sırayla, atla ve yeniden başlat çalışır', () => {
  let ob = defaultOnboarding();
  assert.equal(currentGuideStep(ob)?.id, 'welcome');
  ob = withCompletedStep(ob, 'welcome');
  assert.equal(currentGuideStep(ob)?.id, 'open-market');
  assert.equal(currentGuideStep({ ...ob, dismissed: true }), null);
  assert.equal(currentGuideStep(restartedOnboarding({ ...ob, dismissed: true }))?.id, 'welcome');
  const ids = GUIDE_STEPS.map((s) => s.id);
  assert.deepEqual(ids.slice(0, 8), ['welcome', 'open-market', 'pick-stock', 'buy', 'sectors', 'sell', 'market-day', 'city-tab']);
  assert.ok(ids.includes('opening-capital') && ids.includes('first-order') && ids.includes('first-hire'));
});

test('Rehber metni gerçek kurallarla uyumlu: kâr şartı yok, iki sektör + sat + fiyat güncellemesi', () => {
  const welcome = GUIDE_STEPS[0].text({ cash: '₺100.000' } as never);
  assert.ok(!/para kazan/i.test(welcome));
  assert.ok(/iki farklı sektör/.test(welcome) && /bir pozisyon sat/.test(welcome) && /fiyat güncellemesi/.test(welcome));
});

test('Pencere koordinasyonu: biri açılınca diğerleri kapanır, rehber girişi başka pencere varken beklemez', () => {
  assert.deepEqual(overlaysToClose('settings').includes('settings'), false);
  assert.equal(overlaysToClose('building').length, ALL_OVERLAYS.length - 1);
  const none = Object.fromEntries(ALL_OVERLAYS.map((o) => [o, false])) as OverlayFlags;
  assert.equal(welcomeGuideMayShow(none, false), true);
  assert.equal(welcomeGuideMayShow(none, true), false, 'çevrimdışı özet açıkken rehber çıkmaz');
  assert.equal(welcomeGuideMayShow({ ...none, settings: true }, false), false);
  assert.equal(welcomeGuideMayShow({ ...none, building: true }, false), false);
});

test('Ferah alt menü: en çok 5 sekme; Haberler ilk alımdan sonra üst çubukta görünür', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  passGate(eng);
  const nav = renderNav(eng);
  const count = (nav.match(/data-testid="bottom-nav-(city|market|portfolio|company|bank|news|guide)"/g) ?? []).length;
  assert.ok(count <= 5, `alt menüde ${count} sekme`);
  assert.ok(!nav.includes('bottom-nav-news"'));
  const top = renderTop(eng);
  assert.ok(top.includes('data-testid="top-news-btn"'));
  assert.ok(top.includes('data-testid="game-speed-toggle"'));
  assert.ok(top.includes('data-testid="top-notifications-btn"'));
  assert.ok(top.includes('data-testid="top-settings-btn"'));
});
