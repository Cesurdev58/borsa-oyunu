/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Şehir hizmetleri penceresi: şehirde İkinci El Pazarı, Belediye, Trafo, Akademi ya da Sağlık Merkezi binasına dokununca açılır.
 * Motor `engine/CityServices.ts`, veri `data/cityServices.ts`. Rahat oyun ilkesi: üstte tek büyük sayı,
 * altında kısa liste ve büyük düğmeler.
 */
import React, { useState } from 'react';
import { Check, GraduationCap, HeartPulse, Lock, Recycle, Sun, Landmark, X } from 'lucide-react';
import {
  CITY_PROJECTS,
  INSURANCE_CUSTOMERS_PCT,
  SECONDHAND_SELL_RATE,
  TRAINING_BASKET_PCT,
  USED_UPGRADE_DAYS,
} from '../../data/cityServices';
import {
  cityProjectCustomerMultiplier,
  fundedCityProjects,
  insuranceDailyPremium,
  nextCityProject,
  secondHandStockLines,
  solarDailySaving,
  solarPanelCost,
  trainedStaffCount,
  trainingCostPerPerson,
  untrainedStaffCount,
  usedUpgradeOffers,
} from '../../engine/CityServices';
import type { SimulationState } from '../../models/simulation';
import type { CityServiceId } from './city/cityVisualTypes';

export interface CityServiceHandlers {
  onSellShopStock?: (shopId: string, resourceId: string) => void;
  onBuyUsedUpgrade?: (offerKey: string) => void;
  onFundProject?: (projectId: string) => void;
  onBuySolar?: (shopId: string) => void;
  onTrainStaff?: (shopId: string) => void;
  onSetInsurance?: (shopId: string, on: boolean) => void;
}

const TITLES: Record<CityServiceId, string> = {
  IKINCI_EL: 'İkinci El Pazarı',
  BELEDIYE: 'Belediye',
  ENERJI: 'Trafo ve Enerji',
  AKADEMI: 'Akademi',
  SAGLIK: 'Sağlık Merkezi',
};

const ICONS = { IKINCI_EL: Recycle, BELEDIYE: Landmark, ENERJI: Sun, AKADEMI: GraduationCap, SAGLIK: HeartPulse } as const;

export const CityServicesModal: React.FC<
  {
    service: CityServiceId | null;
    state: SimulationState;
    spendableCash: number;
    formatCurrency: (v: number) => string;
    onClose: () => void;
  } & CityServiceHandlers
> = ({ service, state, spendableCash, formatCurrency, onClose, ...h }) => {
  const [tab, setTab] = useState<'sell' | 'buy'>('sell');
  const [shopPick, setShopPick] = useState<string | null>(null);
  if (!service) return null;
  const fc = (v: number) => formatCurrency(v).replace(/,00$/, '');
  const shops = (state.tradeState?.shops ?? []).filter((s) => !s.isCompanyBranch);
  const Icon = ICONS[service];

  let hero: { label: string; value: string; note: string };
  let body: React.ReactNode;

  if (shops.length === 0) {
    hero = { label: 'Kapalı', value: '—', note: 'İlk dükkânını açınca burayı kullanabilirsin.' };
    body = null;
  } else if (service === 'IKINCI_EL') {
    const shop = shops.find((s) => s.shopId === shopPick) ?? shops[0];
    const lines = secondHandStockLines(shop);
    const offers = usedUpgradeOffers(state);
    hero =
      tab === 'sell'
        ? {
            label: `${shop.nameTR} · rafta satılabilir`,
            value: fc(lines.reduce((s, l) => s + l.payout, 0)),
            note: `Mal, alış fiyatının %${Math.round(SECONDHAND_SELL_RATE * 100)}'ına hemen satılır. Para dükkân kasasına girer.`,
          }
        : {
            label: 'Bugünkü ilanlar',
            value: String(offers.filter((o) => !o.sold).length),
            note: `Yenisinin yarı fiyatına, ${USED_UPGRADE_DAYS} gün dayanır. İlanlar her gün yenilenir.`,
          };
    body = (
      <>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="secondhand-tab-sell"
            data-active={tab === 'sell' ? 'true' : 'false'}
            onClick={() => setTab('sell')}
            className="g-choice min-h-[48px] font-extrabold"
          >
            Malını sat
          </button>
          <button
            type="button"
            data-testid="secondhand-tab-buy"
            data-active={tab === 'buy' ? 'true' : 'false'}
            onClick={() => setTab('buy')}
            className="g-choice min-h-[48px] font-extrabold"
          >
            Eşya al
          </button>
        </div>
        {tab === 'sell' ? (
          <>
            {shops.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {shops.map((s) => (
                  <button
                    key={s.shopId}
                    type="button"
                    data-testid={`secondhand-shop-${s.shopId}`}
                    data-active={s.shopId === shop.shopId ? 'true' : 'false'}
                    onClick={() => setShopPick(s.shopId)}
                    className="g-choice shrink-0 px-3 min-h-[44px] font-bold"
                  >
                    {s.nameTR}
                  </button>
                ))}
              </div>
            )}
            {lines.length === 0 ? (
              <p className="g-tip">Bu dükkânın rafında satılacak mal yok.</p>
            ) : (
              <ul className="space-y-2">
                {lines.map((l) => (
                  <li
                    key={l.resourceId}
                    data-testid={`secondhand-line-${l.resourceId}`}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--g-surface-2)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-[var(--g-ink)] leading-tight truncate">{l.name}</div>
                      <div className="text-[13px] font-bold text-[var(--g-muted)]">
                        {l.units.toLocaleString('tr-TR')} birim · alışı {fc(l.costValue)}
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid={`secondhand-sell-${l.resourceId}`}
                      disabled={!h.onSellShopStock}
                      onClick={() => h.onSellShopStock?.(shop.shopId, l.resourceId)}
                      className="g-btn g-btn-gold g-btn-sm shrink-0 px-3 tabular-nums"
                    >
                      Sat · {fc(l.payout)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : offers.length === 0 ? (
          <p className="g-tip">Bugün dükkânlarına uyan ilan yok. Yarın yeni ilanlar gelir.</p>
        ) : (
          <ul className="space-y-2">
            {offers.map((o) => (
              <li
                key={o.key}
                data-testid={`secondhand-offer-${o.def.id}`}
                className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--g-surface-2)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-[var(--g-ink)] leading-tight">{o.def.name}</div>
                  <div className="text-[13px] font-bold text-[var(--g-green-dark)]">{o.def.effectLabel}</div>
                  <div className="text-[13px] text-[var(--g-muted)] truncate">
                    {o.shopName} · {o.days} gün · yenisi <s>{fc(o.newPrice)}</s>
                  </div>
                </div>
                {o.sold ? (
                  <span className="g-pill bg-white text-[var(--g-green-dark)] shrink-0">
                    <Check size={14} strokeWidth={3} /> Satıldı
                  </span>
                ) : (
                <button
                  type="button"
                  data-testid={`secondhand-buy-${o.def.id}`}
                  disabled={!h.onBuyUsedUpgrade}
                  onClick={() => h.onBuyUsedUpgrade?.(o.key)}
                  className="g-btn g-btn-primary g-btn-sm shrink-0 px-3 tabular-nums"
                >
                  {fc(o.price)}
                </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  } else if (service === 'BELEDIYE') {
    const done = new Set(fundedCityProjects(state));
    const next = nextCityProject(state);
    const bonus = Math.round((cityProjectCustomerMultiplier([...done]) - 1) * 1000) / 10;
    hero = {
      label: 'Bütün dükkânlarına ek müşteri',
      value: `+%${bonus.toLocaleString('tr-TR')}`,
      note: 'Mahalle projelerine katkı ver: etkisi kalıcıdır ve ticari itibarını da artırır.',
    };
    body = (
      <ul className="space-y-2">
        {CITY_PROJECTS.map((p) => {
          const isDone = done.has(p.id);
          const isNext = next?.id === p.id;
          return (
            <li
              key={p.id}
              data-testid={`city-project-${p.id}`}
              data-done={isDone ? 'true' : 'false'}
              className={`flex items-center gap-3 p-3 rounded-2xl ${isDone ? 'bg-[#ecfaf3]' : 'bg-[var(--g-surface-2)]'}`}
            >
              <span className="w-12 h-12 shrink-0 rounded-2xl bg-white flex items-center justify-center text-[26px]">{p.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-[var(--g-ink)] leading-tight">{p.name}</div>
                <div className="text-[13px] font-bold text-[var(--g-green-dark)]">
                  +%{p.customersPct} müşteri · +{p.reputation} itibar
                </div>
              </div>
              {isDone ? (
                <span className="g-pill bg-white text-[var(--g-green-dark)] shrink-0">
                  <Check size={14} strokeWidth={3} /> Yapıldı
                </span>
              ) : isNext ? (
                <button
                  type="button"
                  data-testid={`city-project-fund-${p.id}`}
                  disabled={!h.onFundProject || spendableCash < p.price}
                  onClick={() => h.onFundProject?.(p.id)}
                  className="g-btn g-btn-gold g-btn-sm shrink-0 px-3 tabular-nums"
                >
                  {fc(p.price)}
                </button>
              ) : (
                <span className="g-pill bg-white text-[var(--g-muted)] shrink-0">
                  <Lock size={14} /> Sırada
                </span>
              )}
            </li>
          );
        })}
      </ul>
    );
  } else if (service === 'AKADEMI') {
    const totalStaff = shops.reduce((t, x) => t + x.staffCount, 0);
    const trained = shops.reduce((t, x) => t + trainedStaffCount(x), 0);
    hero = {
      label: 'Eğitimli çalışan',
      value: `${trained}/${totalStaff}`,
      note: `Eğitimli çalışan daha iyi satar: bütün çalışanlar eğitimliyse müşteriler %${TRAINING_BASKET_PCT} daha çok harcar. Bir kez ödenir. Yeni işe aldığın çalışan eğitimsiz gelir.`,
    };
    body = (
      <ul className="space-y-2">
        {shops.map((s) => {
          const untrained = untrainedStaffCount(s);
          const cost = untrained * trainingCostPerPerson(s);
          const done = untrained === 0;
          return (
            <li
              key={s.shopId}
              data-testid={`training-shop-${s.shopId}`}
              data-done={done ? 'true' : 'false'}
              className={`flex items-center gap-3 p-3 rounded-2xl ${done ? 'bg-[#ecfaf3]' : 'bg-[var(--g-surface-2)]'}`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-[var(--g-ink)] leading-tight truncate">{s.nameTR}</div>
                <div className="text-[13px] font-bold text-[var(--g-muted)]">
                  {trainedStaffCount(s)}/{s.staffCount} çalışan eğitimli
                </div>
              </div>
              {done ? (
                <span className="g-pill bg-white text-[var(--g-green-dark)] shrink-0">
                  <Check size={14} strokeWidth={3} /> Eğitimli
                </span>
              ) : (
                <button
                  type="button"
                  data-testid={`training-buy-${s.shopId}`}
                  disabled={!h.onTrainStaff}
                  onClick={() => h.onTrainStaff?.(s.shopId)}
                  className="g-btn g-btn-gold g-btn-sm shrink-0 px-3 tabular-nums"
                >
                  {untrained} kişi · {fc(cost)}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );
  } else if (service === 'SAGLIK') {
    const insured = shops.filter((s) => s.staffInsurance);
    hero = {
      label: 'Sigortalı dükkân',
      value: `${insured.length}/${shops.length}`,
      note: `Sigortalı çalışan daha istekli çalışır: +%${INSURANCE_CUSTOMERS_PCT} müşteri, zam istemez, rakibe gitmez. Prim her gün maaşla birlikte kasadan düşer; istediğin an kapatırsın.`,
    };
    body = (
      <ul className="space-y-2">
        {shops.map((s) => (
          <li
            key={s.shopId}
            data-testid={`insurance-shop-${s.shopId}`}
            data-on={s.staffInsurance ? 'true' : 'false'}
            className={`flex items-center gap-3 p-3 rounded-2xl ${s.staffInsurance ? 'bg-[#ecfaf3]' : 'bg-[var(--g-surface-2)]'}`}
          >
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-[var(--g-ink)] leading-tight truncate">{s.nameTR}</div>
              <div className="text-[13px] font-bold text-[var(--g-muted)]">
                {s.staffInsurance ? 'Sigortalı · ' : ''}
                {s.staffCount} çalışan · günde {fc(insuranceDailyPremium(s))} prim
              </div>
            </div>
            <button
              type="button"
              data-testid={`insurance-toggle-${s.shopId}`}
              disabled={!h.onSetInsurance}
              onClick={() => h.onSetInsurance?.(s.shopId, !s.staffInsurance)}
              className={`g-btn ${s.staffInsurance ? 'g-btn-secondary' : 'g-btn-primary'} g-btn-sm shrink-0 px-3`}
            >
              {s.staffInsurance ? 'Kapat' : 'Sigortala'}
            </button>
          </li>
        ))}
      </ul>
    );
  } else {
    const saving = shops.filter((s) => s.solarPanel).reduce((sum, s) => sum + solarDailySaving(s), 0);
    hero = {
      label: 'Güneş panelinden günlük tasarruf',
      value: fc(saving),
      note: 'Güneş paneli dükkânın kira ve işletme giderini %20 düşürür. Bir kez alınır, hep çalışır.',
    };
    body = (
      <ul className="space-y-2">
        {shops.map((s) => (
          <li
            key={s.shopId}
            data-testid={`solar-shop-${s.shopId}`}
            data-owned={s.solarPanel ? 'true' : 'false'}
            className={`flex items-center gap-3 p-3 rounded-2xl ${s.solarPanel ? 'bg-[#ecfaf3]' : 'bg-[var(--g-surface-2)]'}`}
          >
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-[var(--g-ink)] leading-tight truncate">{s.nameTR}</div>
              <div className="text-[13px] font-bold text-[var(--g-green-dark)]">Günlük gider −{fc(solarDailySaving(s))}</div>
            </div>
            {s.solarPanel ? (
              <span className="g-pill bg-white text-[var(--g-green-dark)] shrink-0">
                <Check size={14} strokeWidth={3} /> Kurulu
              </span>
            ) : (
              <button
                type="button"
                data-testid={`solar-buy-${s.shopId}`}
                disabled={!h.onBuySolar}
                onClick={() => h.onBuySolar?.(s.shopId)}
                className="g-btn g-btn-gold g-btn-sm shrink-0 px-3 tabular-nums"
              >
                {fc(solarPanelCost(s))}
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={TITLES[service]}
      data-testid="city-service-modal"
      data-service={service}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgba(18,28,68,.55)] p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="g-rise w-full max-w-md max-h-[85vh] bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden text-sm"
      >
        <div className="g-hero rounded-none px-4 py-4 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className="w-6 h-6 text-[var(--g-gold)]" />
              <h2 className="g-display text-lg font-extrabold text-white leading-tight">{TITLES[service]}</h2>
            </div>
            <button
              type="button"
              aria-label="Kapat"
              data-testid="city-service-close-btn"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="g-hero-label">{hero.label}</div>
          <div data-testid="city-service-hero-value" className="g-hero-value text-5xl tabular-nums">
            {hero.value}
          </div>
          <p className="text-[13px] font-semibold text-white/70">{hero.note}</p>
        </div>
        <div className="p-3 overflow-y-auto space-y-3 flex-1">{body}</div>
      </div>
    </div>
  );
};
