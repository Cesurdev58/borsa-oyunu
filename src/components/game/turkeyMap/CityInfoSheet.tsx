/**
 * Şehir bilgi paneli (alt sayfa) — Faz 4.
 * Rakamlar şehir tanımından (`CITY_DEFINITIONS`) ve motorun gerçek açılış teklifinden (`getCityOpeningQuote`) gelir;
 * arayüzde uydurma sayı yoktur. Aşağı sürükleyince ya da Kapat'a basınca kapanır.
 */
import React, { useEffect, useRef, useState } from 'react';
import { X, MapPin, Store, AlertTriangle } from 'lucide-react';
import type { CityDefinition, CityDifficulty } from '../../../models/cities';
import type { SimulationState } from '../../../models/simulation';
import { SECTOR_CONFIGS } from '../../../data/sectors';
import { SHOP_TEMPLATES } from '../../../data/tradeCatalog';
import { getCityPresence } from '../../../engine/CityMigration';
import { cityIssueLabels, getCityOpeningQuote, getCityShopSummary } from '../../../engine/CityOpeningQuote';
import type { SectorId } from '../../../models/market';
import type { ShopType } from '../../../models/trade';

const DIFFICULTY_LABEL: Record<CityDifficulty, string> = { EASY: 'Kolay', MEDIUM: 'Orta', HARD: 'Zor' };

/** 1,12 → "+%12", 0,92 → "−%8", 1,00 → "Ortalama". */
export function formatMultiplier(m: number): string {
  const pct = Math.round((m - 1) * 100);
  if (pct === 0) return 'Ortalama';
  return pct > 0 ? `+%${pct}` : `−%${Math.abs(pct)}`;
}

/** Çarpanın oyuncu için iyi mi kötü mü olduğu (kira/ücret/lojistik/rekabet yüksekse kötü). */
type Tone = 'good' | 'bad' | 'neutral';
function tone(m: number, higherIsBetter: boolean): Tone {
  const pct = Math.round((m - 1) * 100);
  if (pct === 0) return 'neutral';
  return (pct > 0) === higherIsBetter ? 'good' : 'bad';
}
const TONE_CLASS: Record<Tone, string> = {
  good: 'text-emerald-600',
  bad: 'text-red-600',
  neutral: 'text-[var(--g-muted)]',
};

export interface CityInfoSheetProps {
  city: CityDefinition;
  state: SimulationState;
  formatCurrency: (v: number) => string;
  /** Rezerve edilmiş nakit (bekleyen emirler); maliyet "yetiyor mu" hesabına girer. */
  reservedCash?: number;
  onClose: () => void;
  /** Şehirdeki dükkânlara git (Dükkân ekranı). Yalnızca dükkân varken çağrılır. */
  onGoToCity: (cityId: CityDefinition['id']) => void;
  /** İlk (ya da yeni) mağazayı bu şehirde aç. */
  onOpenShop: (cityId: CityDefinition['id'], shopType: ShopType) => void;
  /** Yeni kariyer şehir seçimi: verilirse eylem alanında yalnızca "Bu Şehirde Başla" gösterilir. */
  onStartHere?: (cityId: CityDefinition['id']) => void;
}

export const CityInfoSheet: React.FC<CityInfoSheetProps> = ({
  city,
  state,
  formatCurrency,
  reservedCash = 0,
  onClose,
  onGoToCity,
  onOpenShop,
  onStartHere,
}) => {
  const quoteRef = useRef<HTMLDivElement>(null);
  const presenceRef = useRef<HTMLDivElement>(null);
  const scrollTo = (el: HTMLElement | null) => el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  const presence = getCityPresence(state, city.id);
  const summary = getCityShopSummary(state, city.id);
  const issueLabels = cityIssueLabels(state, city.id);
  const hasShop = presence.shopCount > 0;
  const quote = getCityOpeningQuote(state, city.id, 'BUFE', reservedCash);
  const x = quote.expansion;
  // Rezervin altında kalınıyorsa engel yok: ilk basışta uyarı, aynı seçimle ikinci basışta açılır
  const [confirmedLow, setConfirmedLow] = useState(false);
  useEffect(() => setConfirmedLow(false), [city.id]);
  const askOpen = () => {
    if (x.needsSecondConfirmation && !confirmedLow) {
      setConfirmedLow(true);
      return;
    }
    onOpenShop(city.id, 'BUFE');
  };

  // Aşağı sürükleyerek kapatma
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const onDown = (e: React.PointerEvent) => {
    // Kapat düğmesine basılırsa sürükleme başlamaz: işaretçi yakalanırsa düğmenin tıklaması kaybolur.
    if ((e.target as Element).closest?.('button')) return;
    startY.current = e.clientY;
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch { /* yok say */ }
  };
  const onMove = (e: React.PointerEvent) => {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  };
  const onUp = () => {
    if (dragY > 90) onClose();
    setDragY(0);
    startY.current = null;
  };

  const rows: Array<{ label: string; value: number; higherIsBetter: boolean; help: string }> = [
    { label: 'Müşteri talebi', value: city.demandMultiplier, higherIsBetter: true, help: 'Yüksekse daha çok müşteri gelir.' },
    { label: 'Halkın alım gücü', value: city.purchasingPowerMultiplier, higherIsBetter: true, help: 'Yüksekse müşteri sepeti büyür.' },
    { label: 'Kira', value: city.rentMultiplier, higherIsBetter: false, help: 'Yüksekse dükkân kirası pahalıdır.' },
    { label: 'Çalışan maaşı', value: city.wageMultiplier, higherIsBetter: false, help: 'Yüksekse çalışan maliyeti artar.' },
    { label: 'Rekabet', value: city.competitionMultiplier, higherIsBetter: false, help: 'Yüksekse rakip dükkân çoktur.' },
    { label: 'Mal taşıma', value: city.logisticsMultiplier, higherIsBetter: false, help: 'Yüksekse mal getirmek pahalıdır.' },
  ];

  const bonusList: Array<{ label: string; value: number }> = [
    ...(Object.entries(city.shopBonuses) as Array<[ShopType, number]>).map(([t, v]) => ({
      label: SHOP_TEMPLATES[t]?.nameTR ?? t,
      value: v,
    })),
    ...(Object.entries(city.sectorBonuses) as Array<[SectorId, number]>).map(([s, v]) => ({
      label: SECTOR_CONFIGS[s]?.name ?? s,
      value: v,
    })),
  ].filter((b) => Number.isFinite(b.value) && b.value !== 0);

  return (
    <div
      data-testid="city-info-sheet"
      data-city-id={city.id}
      role="dialog"
      aria-modal="false"
      aria-label={`${city.nameTR} şehir bilgisi`}
      className="absolute left-0 right-0 bottom-0 z-30 max-h-[78%] overflow-y-auto rounded-t-3xl bg-[var(--g-surface)] shadow-[0_-8px_30px_rgba(0,0,0,0.35)] g-rise"
      style={{ transform: `translateY(${dragY}px)`, transition: dragY ? 'none' : 'transform 0.2s' }}
    >
      <div
        className="sticky top-0 z-10 bg-[var(--g-surface)] pt-2 pb-1 touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        data-testid="city-info-sheet-handle"
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300" />
        <div className="flex items-start justify-between gap-3 px-4 pt-2">
          <div>
            <div className="g-display text-2xl text-[var(--g-navy-800,#0b1f36)]" data-testid="city-info-name">{city.nameTR}</div>
            <div className="text-[13px] text-[var(--g-muted)]">
              <span data-testid="city-info-difficulty">{DIFFICULTY_LABEL[city.difficulty]}</span> · {city.playStyleTR}
            </div>
          </div>
          <button
            type="button"
            data-testid="city-info-close-btn"
            aria-label="Paneli kapat"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--g-surface-2)] text-[var(--g-ink)] active:scale-90"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-5 pt-2">
        {/* Oyuncunun bu şehirdeki durumu */}
        <div ref={presenceRef} className="g-card-soft rounded-2xl p-3" data-testid="city-info-presence">
          <div className="flex items-center gap-2 text-[15px] font-bold text-[var(--g-ink)]">
            <Store size={18} />
            {hasShop ? `${presence.shopCount} mağazan var` : 'Burada henüz mağazan yok'}
            {presence.isHeadquarters && <span className="g-pill" data-testid="city-info-hq">Şirket merkezi</span>}
          </div>
          {hasShop && (
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[13px] text-[var(--g-muted)]">Dünkü satış</div>
                <div className="font-bold" data-testid="city-info-revenue">{formatCurrency(summary.yesterdayRevenue)}</div>
              </div>
              <div>
                <div className="text-[13px] text-[var(--g-muted)]">Dünkü kâr</div>
                <div className={`font-bold ${summary.yesterdayNetProfit < 0 ? 'text-red-600' : 'text-emerald-600'}`} data-testid="city-info-profit">
                  {formatCurrency(summary.yesterdayNetProfit)}
                </div>
              </div>
              <div>
                <div className="text-[13px] text-[var(--g-muted)]">Sorun</div>
                <div className={`font-bold ${summary.issueCount > 0 ? 'text-red-600' : 'text-[var(--g-ink)]'}`} data-testid="city-info-issues">
                  {summary.issueCount > 0 && <AlertTriangle size={14} className="mr-1 inline" />}
                  {summary.issueCount}
                </div>
              </div>
            </div>
          )}
          {issueLabels.length > 0 && (
            <ul className="mt-2 space-y-1" data-testid="city-info-issue-list">
              {issueLabels.map((label) => (
                <li key={label} className="flex items-center gap-1.5 text-[13px] font-bold text-red-600">
                  <AlertTriangle size={14} className="shrink-0" /> {label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Şehir ekonomisi */}
        <div data-testid="city-info-economy">
          <div className="g-section-title mb-1">Şehir ekonomisi</div>
          <div className="grid grid-cols-2 gap-2">
            {rows.map((r) => {
              const t = tone(r.value, r.higherIsBetter);
              return (
                <div key={r.label} className="g-card-soft rounded-xl p-2.5" data-testid={`city-info-stat-${r.label}`}>
                  <div className="text-[13px] text-[var(--g-muted)]">{r.label}</div>
                  <div className={`text-[17px] font-extrabold ${TONE_CLASS[t]}`}>{formatMultiplier(r.value)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {bonusList.length > 0 && (
          <div data-testid="city-info-bonuses">
            <div className="g-section-title mb-1">Bu şehirde daha iyi satanlar</div>
            <div className="flex flex-wrap gap-1.5">
              {bonusList.map((b) => (
                <span key={b.label} className="g-pill">
                  {b.label} {b.value > 0 ? '+' : '−'}%{Math.abs(Math.round(b.value * 100))}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2" data-testid="city-info-pros-cons">
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="text-[13px] font-extrabold text-emerald-700">Artıları</div>
            <ul className="mt-1 space-y-0.5 text-[14px] text-emerald-900">
              {city.advantagesTR.map((a) => <li key={a}>• {a}</li>)}
            </ul>
          </div>
          <div className="rounded-xl bg-red-50 p-3">
            <div className="text-[13px] font-extrabold text-red-700">Dikkat</div>
            <ul className="mt-1 space-y-0.5 text-[14px] text-red-900">
              {city.disadvantagesTR.map((a) => <li key={a}>• {a}</li>)}
            </ul>
          </div>
        </div>

        {/* Gerçek açılış maliyeti */}
        <div ref={quoteRef} className="g-card-soft rounded-2xl p-3" data-testid="city-info-quote">
          <div className="g-section-title mb-1">{hasShop ? 'Yeni mağaza maliyeti' : 'İlk mağaza maliyeti'} ({quote.shopNameTR})</div>
          <div className="space-y-1 text-[15px]">
            <div className="flex justify-between"><span>Kurulum ve dekorasyon</span><b data-testid="city-info-quote-setup">{formatCurrency(quote.setupCost)}</b></div>
            <div className="flex justify-between"><span>Kira depozitosu</span><span data-testid="city-info-quote-deposit">{formatCurrency(x.cityRentDeposit)}</span></div>
            {x.regionalPermitCost > 0 && (
              <div className="flex justify-between"><span>Bölge ruhsatı</span><span data-testid="city-info-quote-permit">{formatCurrency(x.regionalPermitCost)}</span></div>
            )}
            {x.initialLogisticsCost > 0 && (
              <div className="flex justify-between"><span>Mal taşıma hattı kurulumu</span><span data-testid="city-info-quote-logistics">{formatCurrency(x.initialLogisticsCost)}</span></div>
            )}
            {x.discountKind !== 'NONE' && (
              <div className="flex justify-between text-green-700"><span>{x.discountKind === 'PRESTIGE' ? 'Prestij indirimi' : 'Kilometre taşı indirimi'}</span><b data-testid="city-info-quote-discount">−{formatCurrency(x.prestigeDiscount + x.milestoneDiscount)}</b></div>
            )}
            <div className="flex justify-between"><span>Dükkân kasasına konan para</span><b data-testid="city-info-quote-working">{formatCurrency(quote.workingCash)}</b></div>
            <div className="flex justify-between border-t border-[var(--g-line)] pt-1"><span className="font-bold">Şimdi ödenecek toplam</span><b className="text-[var(--g-gold-dark,#b8860b)]" data-testid="city-info-quote-total">{formatCurrency(quote.totalUpfrontCost)}</b></div>
            <div className="flex justify-between text-[var(--g-muted)]"><span>Rafları doldurma (yaklaşık)</span><span data-testid="city-info-quote-stock">{formatCurrency(quote.firstStockCost)}</span></div>
            <div className="flex justify-between text-[var(--g-muted)]"><span>Önerilen güvenlik parası (7 gün)</span><span data-testid="city-info-quote-reserve">{formatCurrency(x.recommendedReserve)}</span></div>
            <div className="flex justify-between text-[var(--g-muted)]">
              <span>İlk mal teslimatı</span>
              <span data-testid="city-info-quote-delivery">{quote.estimatedDeliveryDays === null ? 'Teklif yok' : `~${quote.estimatedDeliveryDays} gün`}</span>
            </div>
          </div>
          {x.logisticsNotesTR.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[13px] text-[var(--g-muted)]" data-testid="city-info-logistics-notes">
              {x.logisticsNotesTR.map((n) => <li key={n}>🚚 {n}</li>)}
            </ul>
          )}
          {x.warningsTR.length > 0 && (
            <ul
              className={`mt-2 space-y-0.5 text-[13px] font-semibold ${x.warningLevel === 'CRITICAL' || x.warningLevel === 'RED' || !x.affordable ? 'text-red-700' : x.warningLevel === 'YELLOW' ? 'text-amber-700' : 'text-[var(--g-muted)]'}`}
              data-testid="city-info-quote-warnings"
              data-level={x.warningLevel}
            >
              {x.warningsTR.map((w) => <li key={w}>• {w}</li>)}
            </ul>
          )}
          {!quote.affordable && (
            <div className="mt-2 text-[13px] font-semibold text-red-600" data-testid="city-info-quote-short">
              Harcanabilir paran {formatCurrency(quote.spendableCash)}; {formatCurrency(quote.totalUpfrontCost - quote.spendableCash)} eksik.
            </div>
          )}
        </div>

        {/* Eylemler */}
        <div className="grid gap-2" data-testid="city-info-actions">
          {onStartHere ? (
            <button type="button" className="g-btn g-btn-primary min-h-[56px] text-[17px]" data-testid="city-start-here-btn" onClick={() => onStartHere(city.id)}>
              Bu Şehirde Başla
            </button>
          ) : hasShop ? (
            <>
              <button type="button" className="g-btn g-btn-navy min-h-[52px]" data-testid="city-go-btn" onClick={() => onGoToCity(city.id)}>
                <MapPin size={18} /> Şehre Git
              </button>
              <button type="button" className="g-btn g-btn-primary min-h-[52px]" data-testid="city-open-shop-btn" onClick={askOpen}>
                {confirmedLow ? 'Yine de aç' : 'Yeni Mağaza Aç'}
              </button>
              <button type="button" className="g-btn g-btn-secondary min-h-[48px]" data-testid="city-stats-btn" onClick={() => scrollTo(presenceRef.current)}>
                Şehir İstatistikleri
              </button>
            </>
          ) : (
            <>
              <button type="button" className="g-btn g-btn-primary min-h-[52px]" data-testid="city-open-first-shop-btn" onClick={askOpen}>
                {confirmedLow ? 'Yine de aç' : 'İlk Mağazanı Aç'}
              </button>
              <button type="button" className="g-btn g-btn-secondary min-h-[48px]" data-testid="city-costs-btn" onClick={() => scrollTo(quoteRef.current)}>
                Maliyetleri İncele
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
