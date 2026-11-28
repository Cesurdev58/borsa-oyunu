/**
 * Şehir Mağazaları (Faz 6): yalnızca seçili şehirdeki oyuncu dükkânları.
 * Sol üstte sabit "Haritaya Dön" düğmesi (en az 44×44 px, güvenli alanın altında).
 * Şehirde dükkân yoksa (bozuk durum / doğrudan bağlantı) "Bu şehirde henüz mağazan yok" gösterilir.
 */
import React, { useState } from 'react';
import { ArrowLeft, UserCog, AlertTriangle, Star } from 'lucide-react';
import type { CityId } from '../../../models/cities';
import type { SimulationState } from '../../../models/simulation';
import { CITY_DEFINITIONS } from '../../../data/cityDefinitions';
import { liveShopToday } from '../../../engine/ShopSales';
import { getShopStarTier, shopStars } from '../../../engine/ShopRatingEngine';
import { SHOP_ISSUE_LABEL_TR, cityIssueLabels, shopIssueKindsInState } from '../../../engine/CityOpeningQuote';
import { shopsInCity, summarizeCityShops } from './mapNavigation';
import { CityDepotCard } from './CityDepotCard';
import { SHOP_EMOJI } from '../buildings/ShopDashboard';

export type ShopManageTab = 'ORDER_PRODUCT' | 'EDIT_PRICES' | 'MANAGE_STAFF' | 'UPGRADE_SHOP';

export interface CityShopsScreenProps {
  cityId: CityId;
  state: SimulationState;
  formatCurrency: (v: number) => string;
  onBackToMap: () => void;
  /** Mağaza yönetimini (detay paneli) açar; `tab` hangi bölümle açılacağını söyler. */
  onManageShop: (shopId: string, tab?: ShopManageTab) => void;
  reservedCash?: number;
  /** Şehir deposu kur (verilmezse depo kartı yalnızca bilgi gösterir). */
  onBuildDepot?: (cityId: CityId) => void;
}

export const CityShopsScreen: React.FC<CityShopsScreenProps> = ({ cityId, state, formatCurrency, onBackToMap, onManageShop, reservedCash = 0, onBuildDepot }) => {
  const city = CITY_DEFINITIONS[cityId];
  const shops = shopsInCity(state, cityId);
  const sum = summarizeCityShops(state, cityId);
  const nowMin = state.minutesIntoCurrentDay ?? 0;
  const [accountingOpen, setAccountingOpen] = useState<string | null>(null);
  const reputation = Math.round(state.tradeState?.tradeReputationScore ?? 0);
  const issueLabels = cityIssueLabels(state, cityId);

  return (
    <div className="relative h-[calc(100dvh-236px)] min-h-[360px] w-full overflow-y-auto bg-[var(--g-bg,#f3f5fb)]" data-testid="city-shops-screen" data-city-id={cityId}>
      {/* "Haritaya Dön": ekranın kendi üst köşesine yapışık durur (kaydırınca da görünür), en az 44×44 px.
          Eskiden sayfanın en üstüne sabitlenmişti ve üst çubuğun / hedef şeridinin üstüne biniyordu. */}
      <div className="sticky top-0 z-30 h-0">
        <button
          type="button"
          data-testid="city-shops-back-btn"
          onClick={onBackToMap}
          style={{ left: 'calc(env(safe-area-inset-left, 0px) + 8px)' }}
          className="g-btn g-btn-navy absolute top-2 min-h-[44px] min-w-[44px] px-3 text-[14px]"
        >
          <ArrowLeft size={18} /> Haritaya Dön
        </button>
      </div>

      <div className="g-hero rounded-none px-4 pb-4 pt-16" data-testid="city-shops-header">
        <div className="g-hero-label">Şehir Mağazaları</div>
        <div className="g-display text-3xl font-extrabold text-white" data-testid="city-shops-title">{city.nameTR}</div>
        {shops.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="g-hero-tile"><div className="text-[13px] opacity-70">Mağaza</div><b data-testid="city-shops-count">{sum.shopCount}</b></div>
            <div className="g-hero-tile"><div className="text-[13px] opacity-70">Bugünkü ciro</div><b data-testid="city-shops-revenue">{formatCurrency(sum.dailyRevenue)}</b></div>
            <div className="g-hero-tile"><div className="text-[13px] opacity-70">Bugünkü kâr</div><b data-testid="city-shops-profit">{formatCurrency(sum.dailyNetProfit)}</b></div>
            <div className="g-hero-tile"><div className="text-[13px] opacity-70">Çalışan</div><b data-testid="city-shops-staff">{sum.staffCount}</b></div>
            <div className="g-hero-tile"><div className="text-[13px] opacity-70">Stok sağlığı</div><b data-testid="city-shops-stock">%{sum.stockHealthPct}</b></div>
            <div className="g-hero-tile"><div className="text-[13px] opacity-70">Ticari itibar</div><b data-testid="city-shops-reputation">{reputation}</b></div>
          </div>
        )}
        {issueLabels.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/20 px-3 py-2 text-[14px] font-bold text-white" data-testid="city-shops-issues">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              {sum.issueCount > 0 ? `${sum.issueCount} mağazada sorun var: ` : 'Şehirde sorun var: '}
              {issueLabels.join(' · ')}
            </span>
          </div>
        )}
      </div>

      {shops.length === 0 ? (
        <div className="p-6 text-center" data-testid="city-shops-empty">
          <div className="g-display text-xl font-extrabold text-[var(--g-ink)]">Bu şehirde henüz mağazan yok</div>
          <p className="mt-1 text-[14px] text-[var(--g-muted)]">Haritadan şehre dokunup ilk mağazanı açabilirsin.</p>
          <button type="button" data-testid="city-shops-empty-back-btn" onClick={onBackToMap} className="g-btn g-btn-primary mt-4 min-h-[52px] px-6">
            Haritaya Dön
          </button>
        </div>
      ) : (
        <div className="space-y-3 p-3" data-testid="city-shops-list">
          {shops.map((shop) => {
            const t = liveShopToday(shop, state.day, nowMin);
            const used = shop.inventoryBatches.reduce((a, b) => a + b.quantity, 0);
            const stockPct = Math.min(100, Math.round((used / Math.max(1, shop.shelfCapacity)) * 100));
            const issueKinds = shopIssueKindsInState(state, shop);
            const issue = issueKinds.length > 0;
            const staffText = shop.ownerWorks ? 'Sen çalışıyorsun' : `${shop.staffCount} çalışan`;
            return (
              <div key={shop.shopId} className="g-card overflow-hidden" data-testid={`city-shop-card-${shop.shopId}`} data-shop-city={shop.cityId}>
                <div className="flex items-center gap-3 p-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--g-surface-2)] text-[28px]">{SHOP_EMOJI[shop.shopType] ?? '🏪'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[17px] font-extrabold text-[var(--g-ink)]">{shop.nameTR}</div>
                    <div className="text-[13px] text-[var(--g-muted)]">Seviye {shop.level} · {staffText}</div>
                  </div>
                  <span
                    data-testid={`city-shop-stars-${shop.shopId}`}
                    title={getShopStarTier(shopStars(shop)).labelTR}
                    className="g-pill shrink-0 bg-[var(--g-gold)] text-[#3a2600]"
                  >
                    <Star className="h-3.5 w-3.5 fill-current" /> {shopStars(shop).toFixed(1)}
                  </span>
                  {shop.manager && <span className="g-pill bg-[var(--g-gold)] text-[#5a3a00]"><UserCog className="h-3.5 w-3.5" /> Müdür</span>}
                </div>
                <div className="grid grid-cols-3 gap-2 px-3 text-center">
                  <div className="g-card-soft p-2"><div className="text-[13px] text-[var(--g-muted)]">Ciro</div><b className="tabular-nums">{formatCurrency(t.revenue)}</b></div>
                  <div className="g-card-soft p-2"><div className="text-[13px] text-[var(--g-muted)]">Kâr</div><b className={`tabular-nums ${t.profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(t.profit)}</b></div>
                  <div className="g-card-soft p-2"><div className="text-[13px] text-[var(--g-muted)]">Yıldız</div><b className="tabular-nums">★ {shopStars(shop).toFixed(1)}</b></div>
                </div>
                <div className="px-3 pt-2">
                  <div className="flex justify-between text-[13px] font-semibold text-[var(--g-ink)]"><span>Stok</span><span className={stockPct < 25 ? 'text-red-600' : ''}>%{stockPct}</span></div>
                  <div className="g-track mt-1 h-2.5"><div className={stockPct < 25 ? 'g-fill g-fill-danger' : 'g-fill'} style={{ width: `${stockPct}%` }} /></div>
                </div>
                {(issue || shop.manager) && (
                  <div className={`mx-3 mt-2 rounded-xl px-3 py-2 text-[13px] font-bold ${issue ? 'bg-[#ffe9e8] text-[var(--g-red-dark)]' : 'bg-[var(--g-surface-2)] text-[var(--g-muted)]'}`} data-testid={`city-shop-issue-${shop.shopId}`}>
                    {issue ? issueKinds.map((k) => SHOP_ISSUE_LABEL_TR[k]).join(' · ') : `Müdür: ${shop.manager?.lastActionTR ?? ''}`}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 p-3">
                  <button type="button" className="g-btn g-btn-primary min-h-[48px]" data-testid={`city-shop-manage-${shop.shopId}`} onClick={() => onManageShop(shop.shopId)}>Yönet</button>
                  <button type="button" className="g-btn g-btn-secondary min-h-[48px]" data-testid={`city-shop-order-${shop.shopId}`} onClick={() => onManageShop(shop.shopId, 'ORDER_PRODUCT')}>Stok Sipariş Et</button>
                  <button type="button" className="g-btn g-btn-secondary min-h-[48px]" data-testid={`city-shop-upgrade-${shop.shopId}`} onClick={() => onManageShop(shop.shopId, 'UPGRADE_SHOP')}>Yükselt</button>
                  <button type="button" className="g-btn g-btn-secondary min-h-[48px]" data-testid={`city-shop-staff-${shop.shopId}`} onClick={() => onManageShop(shop.shopId, 'MANAGE_STAFF')}>Çalışanlar</button>
                  <button type="button" className="g-btn g-btn-secondary min-h-[48px]" data-testid={`city-shop-manager-${shop.shopId}`} onClick={() => onManageShop(shop.shopId, 'MANAGE_STAFF')}>Müdür</button>
                  <button type="button" className="g-btn g-btn-secondary min-h-[48px]" data-testid={`city-shop-accounting-${shop.shopId}`} aria-expanded={accountingOpen === shop.shopId} onClick={() => setAccountingOpen(accountingOpen === shop.shopId ? null : shop.shopId)}>Muhasebe</button>
                </div>
                {accountingOpen === shop.shopId && (
                  <div className="mx-3 mb-3 space-y-1 rounded-xl bg-[var(--g-surface-2)] p-3 text-[14px]" data-testid={`city-shop-accounting-panel-${shop.shopId}`}>
                    <div className="flex justify-between"><span>Dünkü satış</span><b>{formatCurrency(shop.todaySalesRevenue)}</b></div>
                    <div className="flex justify-between"><span>Dünkü kâr</span><b>{formatCurrency(shop.todayNetProfit)}</b></div>
                    <div className="flex justify-between"><span>Toplam satış</span><b>{formatCurrency(shop.cumulativeRevenue)}</b></div>
                    <div className="flex justify-between"><span>Toplam kâr</span><b>{formatCurrency(shop.cumulativeNetProfit)}</b></div>
                    <div className="flex justify-between"><span>Dükkân kasası</span><b>{formatCurrency(shop.cashAccountBalance)}</b></div>
                  </div>
                )}
              </div>
            );
          })}
          <CityDepotCard
            cityId={cityId}
            state={state}
            formatCurrency={formatCurrency}
            reservedCash={reservedCash}
            onBuildDepot={onBuildDepot}
          />
        </div>
      )}
    </div>
  );
};
