/**
 * Şehir deposu kartı (Faz 3.2) — Şehir Mağazaları ekranının altında.
 * Rakamlar motordan gelir (`engine/CityDepot.getCityDepotPlan`): bedel, indirim, son 30 günün gerçek nakliyesi,
 * tahmini tasarruf ve geri dönüş süresi. 450 bin ₺'lik harcama iki basışla yapılır (ilk basış onay ister).
 */
import React, { useEffect, useState } from 'react';
import { Warehouse as WarehouseIcon } from 'lucide-react';
import type { SimulationState } from '../../../models/simulation';
import type { CityId } from '../../../models/cities';
import { getCityDepotPlan, listCityDepots } from '../../../engine/CityDepot';

export interface CityDepotCardProps {
  cityId: CityId;
  state: SimulationState;
  formatCurrency: (v: number) => string;
  reservedCash?: number;
  /** Verilmezse kart yalnızca bilgi gösterir (kurma düğmesi çizilmez). */
  onBuildDepot?: (cityId: CityId) => void;
}

export const CityDepotCard: React.FC<CityDepotCardProps> = ({
  cityId,
  state,
  formatCurrency,
  reservedCash = 0,
  onBuildDepot,
}) => {
  const plan = getCityDepotPlan(state, cityId, reservedCash);
  const depot = listCityDepots(state).find((d) => d.cityId === cityId);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [cityId, plan.exists]);

  if (plan.shopCount === 0 && !plan.exists) return null;

  return (
    <div className="g-card p-4" data-testid="city-depot-card" data-depot-exists={plan.exists ? 'true' : 'false'}>
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--g-navy-700,#1c2a63)] text-white">
          <WarehouseIcon size={20} />
        </span>
        <div className="min-w-0">
          <div className="g-section-title">Şehir deposu</div>
          <div className="text-[13px] text-[var(--g-muted)]">
            {plan.exists
              ? `${plan.cityNameTR} deposu çalışıyor`
              : `Buradaki dükkânlarına giden mal %${plan.discountWithDepotPct - plan.discountNowPct} daha ucuz taşınır`}
          </div>
        </div>
      </div>

      {plan.exists && depot ? (
        <div className="mt-3" data-testid="city-depot-status">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="g-card-soft p-2">
              <div className="text-[13px] text-[var(--g-muted)]">Aktif nakliye indirimi</div>
              <b className="tabular-nums text-emerald-600" data-testid="city-depot-active-discount">
                %{plan.discountWithDepotPct}
              </b>
            </div>
            <div className="g-card-soft p-2">
              <div className="text-[13px] text-[var(--g-muted)]">Kapsanan dükkân</div>
              <b className="tabular-nums" data-testid="city-depot-covered-shops">{plan.shopCount}</b>
            </div>
            <div className="g-card-soft p-2">
              <div className="text-[13px] text-[var(--g-muted)]">Son 30 gün tasarruf</div>
              <b className="tabular-nums text-emerald-600" data-testid="city-depot-active-saving">
                {formatCurrency(plan.activeSaving30Days)}
              </b>
            </div>
          </div>
          {depot.usedUnits > 0 && (
            <div className="mt-3" data-testid="city-depot-fill">
              <div className="flex justify-between text-[13px] font-semibold text-[var(--g-ink)]">
                <span>Depodaki mal</span>
                <span className={depot.usedPct >= 95 ? 'text-red-600' : ''}>
                  {depot.usedUnits.toLocaleString('tr-TR')} / {depot.maxUnits.toLocaleString('tr-TR')} birim
                </span>
              </div>
              <div className="g-track mt-1 h-2.5">
                <div
                  className={depot.usedPct >= 95 ? 'g-fill g-fill-danger' : 'g-fill'}
                  style={{ width: `${Math.min(100, depot.usedPct)}%` }}
                />
              </div>
            </div>
          )}
          <p className="g-tip mt-3 text-[13px]">
            {plan.discountNowPct > 0 ? 'Liman dahil indirim. ' : ''}Mal siparişlerinde kendiliğinden uygulanır.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="g-card-soft p-2">
              <div className="text-[13px] text-[var(--g-muted)]">Bedel</div>
              <b className="tabular-nums" data-testid="city-depot-cost">{formatCurrency(plan.cost)}</b>
            </div>
            <div className="g-card-soft p-2">
              <div className="text-[13px] text-[var(--g-muted)]">Aylık tasarruf</div>
              <b className="tabular-nums text-emerald-600" data-testid="city-depot-saving">
                {formatCurrency(plan.estimatedSaving30Days)}
              </b>
            </div>
            <div className="g-card-soft p-2">
              <div className="text-[13px] text-[var(--g-muted)]">Kendini öder</div>
              <b className="tabular-nums" data-testid="city-depot-payback">
                {plan.paybackDays === null ? '—' : `${plan.paybackDays} gün`}
              </b>
            </div>
          </div>
          <p className="mt-2 text-[13px] text-[var(--g-muted)]" data-testid="city-depot-basis">
            Son 30 günde bu şehre {formatCurrency(plan.shippingLast30Days)} nakliye ödedin. Tasarruf buna göre hesaplandı.
          </p>
          {plan.blockReasonTR && (
            <p className="mt-2 text-[13px] font-bold text-red-600" data-testid="city-depot-block">
              {plan.blockReasonTR}
            </p>
          )}
          {onBuildDepot && (
            <button
              type="button"
              data-testid={confirming ? 'city-depot-confirm-btn' : 'city-depot-build-btn'}
              disabled={!plan.canBuild}
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                setConfirming(false);
                onBuildDepot(cityId);
              }}
              className={`g-btn ${confirming ? 'g-btn-gold' : 'g-btn-navy'} mt-3 min-h-[52px] w-full`}
            >
              {confirming
                ? `Evet, ${formatCurrency(plan.cost)} öde ve kur`
                : `Depo kur · ${formatCurrency(plan.cost)}`}
            </button>
          )}
          {confirming && (
            <button
              type="button"
              data-testid="city-depot-cancel-btn"
              onClick={() => setConfirming(false)}
              className="g-btn g-btn-ghost mt-2 min-h-[44px] w-full"
            >
              Vazgeç
            </button>
          )}
        </>
      )}
    </div>
  );
};
