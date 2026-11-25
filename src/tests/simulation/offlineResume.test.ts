import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { evaluateOfflineResume, resumeOfflineProgress } from '../../engine/OfflineResume';
import { OFFLINE_RESUME_MIN_REAL_SECONDS } from '../../data/gameBalance';

const T0 = '2026-03-01T10:00:00.000Z';
const at = (seconds: number) => new Date(Date.parse(T0) + seconds * 1000).toISOString();

function readyEngine(seed = 20261125) {
  const eng = new SimulationEngine(seed, 100_000);
  assert.equal(eng.chooseStartCity('ankara').success, true);
  eng.setFastStartTempo(false); // 1 oyun günü = 15 gerçek dakika
  eng.getState().lastRealTimestampISO = T0;
  return eng;
}

test('Eşiğin altındaki ara: çevrimdışı ilerleme işlenmez, pencere açılmaz', () => {
  const eng = readyEngine();
  const before = eng.getState().totalElapsedGameMinutes;
  const awayFrom = T0;
  const now = at(OFFLINE_RESUME_MIN_REAL_SECONDS - 1);
  assert.equal(evaluateOfflineResume(eng, awayFrom, now).reason, 'BELOW_THRESHOLD');
  assert.equal(resumeOfflineProgress(eng, awayFrom, now), null);
  assert.equal(eng.getState().totalElapsedGameMinutes, before);
  assert.notEqual(eng.getState().lastOfflineSummaryDismissed, false);
});

test('Eşiğin üstündeki ara: çevrimdışı ilerleme işlenir ve "Tekrar hoş geldin" özeti hazırlanır', () => {
  const eng = readyEngine();
  const before = eng.getState().totalElapsedGameMinutes;
  const summary = resumeOfflineProgress(eng, T0, at(30 * 60)); // 30 gerçek dk = 2 oyun günü
  assert.ok(summary, 'özet döndü');
  assert.ok(summary.gameMinutesAdvanced >= 2 * 1440 - 1, `ilerledi: ${summary.gameMinutesAdvanced}`);
  const st = eng.getState();
  assert.equal(st.totalElapsedGameMinutes - before, summary.gameMinutesAdvanced);
  // TycoonGameView'daki açılma koşulu
  assert.ok(st.lastOfflineSummary && !st.lastOfflineSummaryDismissed && st.lastOfflineSummary.gameMinutesAdvanced > 0);
});

test('Çift tetiklenme: aynı dönüş iki kez (sayfa açılışı + visibilitychange / pageshow) işlenmez', () => {
  const eng = readyEngine();
  const now = at(20 * 60);
  const first = resumeOfflineProgress(eng, T0, now);
  assert.ok(first);
  const minutesAfterFirst = eng.getState().totalElapsedGameMinutes;
  const cashAfterFirst = eng.getState().cash;

  // Aynı an, aynı başlangıç
  assert.equal(resumeOfflineProgress(eng, T0, now), null);
  // Birkaç saniye sonra ikinci olay (eski başlangıçla bile): son işlenen andan beri eşik aşılmadı
  assert.equal(evaluateOfflineResume(eng, T0, at(20 * 60 + 5)).reason, 'BELOW_THRESHOLD');
  assert.equal(resumeOfflineProgress(eng, T0, at(20 * 60 + 5)), null);

  assert.equal(eng.getState().totalElapsedGameMinutes, minutesAfterFirst, 'ikinci kez ilerlemedi');
  assert.equal(eng.getState().cash, cashAfterFirst);
  // Pencere hâlâ ilk özeti gösteriyor
  assert.equal(eng.getState().lastOfflineSummary?.gameMinutesAdvanced, first.gameMinutesAdvanced);
  assert.equal(eng.getState().lastOfflineSummaryDismissed, false);
});

test('Duraklatılmış oyunda arka planda geçen süre ilerleme vermez', () => {
  const eng = readyEngine();
  eng.pauseSimulation();
  const before = eng.getState().totalElapsedGameMinutes;
  assert.equal(evaluateOfflineResume(eng, T0, at(3600)).reason, 'PAUSED');
  assert.equal(resumeOfflineProgress(eng, T0, at(3600)), null);
  assert.equal(eng.getState().totalElapsedGameMinutes, before);
});

test('Başlangıç şehri seçilmemiş yeni kariyerde ilerleme işlenmez', () => {
  const eng = new SimulationEngine(20261126, 100_000);
  assert.equal(eng.needsStartCitySelection(), true);
  assert.equal(evaluateOfflineResume(eng, T0, at(3600)).reason, 'CITY_SELECTION');
  assert.equal(resumeOfflineProgress(eng, T0, at(3600)), null);
});

test('Kapatılmamış özet varken ikinci dönüş özeti kaybetmez, üstüne toplar', () => {
  const eng = readyEngine();
  const first = resumeOfflineProgress(eng, T0, at(15 * 60));
  assert.ok(first);
  // Oyuncu pencereyi kapatmadan yine arka plana attı ve 15 dk sonra döndü
  const second = resumeOfflineProgress(eng, at(15 * 60), at(30 * 60));
  assert.ok(second);
  assert.equal(second.startNetWorth, first.startNetWorth, 'başlangıç ilk ayrılış');
  assert.ok(second.gameMinutesAdvanced > first.gameMinutesAdvanced);
  assert.equal(eng.getState().lastOfflineSummary?.gameMinutesAdvanced, second.gameMinutesAdvanced);

  // Pencere kapatıldıktan sonraki dönüş yeni, ayrı bir özet üretir
  eng.acknowledgeOfflineSummary();
  const third = resumeOfflineProgress(eng, at(30 * 60), at(45 * 60));
  assert.ok(third);
  assert.ok(third.gameMinutesAdvanced < second.gameMinutesAdvanced);
});
