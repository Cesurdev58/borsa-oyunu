/**
 * Şirket sekmesinde seçili şehirdeki şirket varlığı: genel merkez ve şirket şubeleri.
 */
import React from 'react';
import { Building2, Store } from 'lucide-react';
import type { CityId } from '../../../models/cities';
import type { SimulationState } from '../../../models/simulation';
import { getCityDefinition } from '../../../data/cityDefinitions';
import { companyBranchesInCity, isCompanyHeadquartersCity } from './cityViewLogic';
import { companyCitySectorMultiplier } from '../../../engine/CityEconomy';
import { SECTOR_CONFIGS } from '../../../data/sectors';
import { COMPANY_CITY_COST_SHARE } from '../../../data/cityBalance';

interface CompanyCityCardProps {
  state: SimulationState;
  cityId: CityId;
  formatCurrency: (v: number) => string;
}

export const CompanyCityCard: React.FC<CompanyCityCardProps> = ({ state, cityId, formatCurrency }) => {
  const company = state.playerCompany;
  const isHq = isCompanyHeadquartersCity(state, cityId);
  const branches = companyBranchesInCity(state, cityId);
  const cityName = getCityDefinition(cityId).nameTR;
  // Genel merkez şehrinin sektör bonusu (Faz 3.3): satış talebi × çarpan, üretim maliyeti ÷ (1 + bonus × pay)
  const sectorMult = company && isHq ? companyCitySectorMultiplier(cityId, company.sector) : 1;
  const salesPct = Math.round((sectorMult - 1) * 100);
  const costPct = Math.round((1 - 1 / (1 + (sectorMult - 1) * COMPANY_CITY_COST_SHARE)) * 100);
  const sectorName = company ? SECTOR_CONFIGS[company.sector]?.name ?? company.sector : '';

  return (
    <div className="g-card p-3 space-y-2" data-testid="company-city-card">
      {isHq && company && (
        <div
          data-testid="company-city-hq"
          className="flex items-center gap-3 rounded-xl bg-[var(--g-surface-2)] px-3 py-2.5"
        >
          <Building2 className="w-6 h-6 shrink-0 text-[var(--g-navy-600)]" />
          <div className="min-w-0">
            <div className="font-extrabold truncate">{company.name}</div>
            <div className="text-[13px] font-semibold text-[var(--g-muted)]">Genel merkez burada</div>
            {salesPct !== 0 && (
              <div
                data-testid="company-city-sector-bonus"
                className={`text-[13px] font-bold ${salesPct > 0 ? 'text-emerald-600' : 'text-red-600'}`}
              >
                {salesPct > 0
                  ? `${cityName} ${sectorName} için güçlü: pazar +%${salesPct}, üretim %${costPct} ucuz`
                  : `${cityName} ${sectorName} için zayıf: pazar −%${Math.abs(salesPct)}, üretim %${Math.abs(costPct)} pahalı`}
              </div>
            )}
          </div>
        </div>
      )}
      {branches.map((b) => (
        <div
          key={b.shopId}
          data-testid={`company-city-branch-${b.shopId}`}
          className="flex items-center gap-3 rounded-xl bg-[var(--g-surface-2)] px-3 py-2.5"
        >
          <Store className="w-6 h-6 shrink-0 text-[var(--g-navy-600)]" />
          <div className="min-w-0 flex-1">
            <div className="font-extrabold truncate">{b.nameTR}</div>
            <div className="text-[13px] font-semibold text-[var(--g-muted)]">Şirket şubesi · Seviye {b.level}</div>
          </div>
          <div className="text-right text-[13px] font-extrabold tabular-nums">
            {formatCurrency(b.todaySalesRevenue)}
            <div className="font-semibold text-[var(--g-muted)]">dünkü satış</div>
          </div>
        </div>
      ))}
      {!isHq && branches.length === 0 && (
        <div data-testid="company-city-empty" className="text-center text-sm font-bold text-[var(--g-muted)] py-2">
          {cityName} şehrinde şirket varlığın yok.
        </div>
      )}
    </div>
  );
};
