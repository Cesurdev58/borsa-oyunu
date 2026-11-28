/**
 * DÜKKÂN YILDIZI (1.0 ★ – 5.0 ★) VE MÜŞTERİ YORUMLARI
 *
 * Saf hesaplar: yalnızca modelleri, katalogu ve denge sabitlerini içe aktarır (bağımlılık döngüsü yok).
 * 4 sütun (her biri 0–100, eşit ağırlık): Ürün Dengesi, Fiyat Adaleti, Raf Sürekliliği, Hizmet & Ortam.
 * Gün kapanışında memnuniyet bu puana yumuşakça yaklaşır; yıldız ve kademe memnuniyetten türetilir.
 * Kademe çarpanı ESKİ memnuniyet çarpanının yerine `ShopSales.computeShopDailyDemand` içinde kullanılır.
 * Yorumlar tohum + gün + dükkân kimliğinden üretilir; motorun sayı üretecine dokunmaz.
 */
import type { ShopCustomerReview, ShopInstance, ShopRatingPillar } from '../models/trade';
import { RESOURCE_CATALOG, SHOP_TEMPLATES } from '../data/tradeCatalog';
import {
  SHOP_RATING_BLEND,
  SHOP_SERVICE_WEIGHTS,
  SHOP_STAR_DEMAND_CALIBRATION,
  SHOP_REVIEWS_MAX,
  SHOP_STAR_CURVE,
  SHOP_STAR_TIERS,
  type ShopStarTierDef,
} from '../data/gameBalance';

export interface ShopRatingPillars {
  VARIETY: number;
  PRICE: number;
  STOCK: number;
  SERVICE: number;
}

export interface ShopRatingBreakdown {
  pillars: ShopRatingPillars;
  /** 4 sütunun ortalaması (0–100) */
  score: number;
  /** Bu puanın yıldızı (memnuniyete yansımadan önceki anlık değer) */
  stars: number;
}

export const PILLAR_LABEL_TR: Record<ShopRatingPillar, string> = {
  VARIETY: 'Ürün Dengesi',
  PRICE: 'Fiyat Adaleti',
  STOCK: 'Raf Sürekliliği',
  SERVICE: 'Hizmet & Ortam',
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const safe = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback);

/** 0–100 puanı 1.0–5.0 yıldıza çevirir (bir ondalık). */
export function scoreToStars(score: number): number {
  return Number((1 + (clamp(safe(score, 50), 0, 100) / 100) * 4).toFixed(1));
}

/** Dükkânın şu anki yıldızı: memnuniyetten türetilir (eski kayıtta da çalışır). */
export function shopStars(shop: Pick<ShopInstance, 'customerSatisfaction'>): number {
  return scoreToStars(shop.customerSatisfaction);
}

/** Yıldızın kademesi (Kötü Şöhret … Efsane Mekân). */
export function getShopStarTier(stars: number): ShopStarTierDef {
  let tier = SHOP_STAR_TIERS[0];
  for (const t of SHOP_STAR_TIERS) if (stars >= t.minStars - 1e-9) tier = t;
  return tier;
}

/** Bir sonraki kademe ve ona kalan yıldız (en üst kademede null). */
export function nextStarTier(stars: number): { tier: ShopStarTierDef; starsNeeded: number } | null {
  const next = SHOP_STAR_TIERS.find((t) => t.minStars > stars + 1e-9);
  return next ? { tier: next, starsNeeded: Number((next.minStars - stars).toFixed(1)) } : null;
}

function curveAt(stars: number, col: 1 | 2): number {
  const pts = SHOP_STAR_CURVE;
  if (stars <= pts[0][0]) return pts[0][col];
  for (let i = 1; i < pts.length; i++) {
    if (stars <= pts[i][0]) {
      const t = (stars - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
      return lerp(pts[i - 1][col], pts[i][col], t);
    }
  }
  return pts[pts.length - 1][col];
}

/** Yıldıza göre müşteri çarpanı (kademeler arası yumuşak geçiş). */
export function starCustomerMultiplier(stars: number): number {
  return curveAt(clamp(safe(stars, 3), 1, 5), 1) * SHOP_STAR_DEMAND_CALIBRATION;
}

/** Arayüzde gösterilen kademe bonusu (ayar sabitinden bağımsız, "+%15 müşteri" gibi). */
export function starTierBonusLabelsTR(stars: number): string[] {
  const t = getShopStarTier(stars);
  const out: string[] = [];
  const c = Math.round((t.customerMult - 1) * 100);
  if (c !== 0) out.push(`${c > 0 ? '+' : '−'}%${Math.abs(c)} Müşteri`);
  const b = Math.round((t.basketMult - 1) * 100);
  if (b > 0) out.push(`+%${b} Sepet`);
  if (t.dailyReputation > 0) out.push(`+${t.dailyReputation} itibar/gün`);
  return out;
}

/** Yıldıza göre sepet çarpanı. */
export function starBasketMultiplier(stars: number): number {
  return curveAt(clamp(safe(stars, 3), 1, 5), 2);
}

function fairPrice(resId: string, marginPct: number): number {
  const def = RESOURCE_CATALOG[resId];
  return def ? def.baseMarketPrice * (1 + marginPct / 100) : 0;
}

function stockByResource(shop: ShopInstance): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of shop.inventoryBatches) {
    if (b.availableQuantity > 0) m.set(b.resourceId, (m.get(b.resourceId) ?? 0) + b.availableQuantity);
  }
  return m;
}

/** Fiyat oranını (satış / adil fiyat) 0–100 puana çevirir. */
export function priceRatioScore(ratio: number): number {
  const r = safe(ratio, 1);
  if (r <= 1.05) return clamp(85 + ((1.05 - r) / 0.25) * 15, 85, 100);
  if (r <= 1.25) return lerp(84, 65, (r - 1.05) / 0.2);
  if (r <= 1.5) return lerp(64, 35, (r - 1.25) / 0.25);
  return clamp(lerp(34, 0, (r - 1.5) / 0.5), 0, 34);
}

/** 4 sütunu hesaplar (biten günün satış/karşılanamayan talep rakamları ve şu anki raf). */
export function computeShopRating(shop: ShopInstance): ShopRatingBreakdown {
  const tpl = SHOP_TEMPLATES[shop.shopType];
  const allowed = tpl?.allowedResourceIds ?? [];
  const stock = stockByResource(shop);

  // 1) Ürün Dengesi
  let variety: number;
  if (allowed.length <= 1) {
    // Tek ürünlü türler (galeri): çeşitlilik yerine stok sürekliliği + garanti memnuniyeti
    const has = allowed.some((id) => (stock.get(id) ?? 0) > 0);
    const warranty = safe(shop.specificState?.warrantySatisfactionBonus ?? 8, 8);
    variety = clamp((has ? 75 : 25) + Math.min(25, warranty * 2), 0, 100);
  } else {
    const qty = allowed.map((id) => stock.get(id) ?? 0);
    const total = qty.reduce((a, b) => a + b, 0);
    const coverage = qty.filter((q) => q > 0).length / allowed.length;
    let evenness = 0;
    if (total > 0) {
      let h = 0;
      for (const q of qty) {
        if (q <= 0) continue;
        const p = q / total;
        h -= p * Math.log(p);
      }
      evenness = h / Math.log(allowed.length);
    }
    variety = clamp(100 * (0.7 * coverage + 0.3 * evenness), 0, 100);
  }

  // 2) Fiyat Adaleti: rafta (yoksa bütün) ürünlerin ortalama fiyat oranı
  const priced = (stock.size > 0 ? allowed.filter((id) => stock.has(id)) : allowed).filter(
    (id) => fairPrice(id, tpl?.defaultGrossMarginPct ?? 0) > 0
  );
  let ratioSum = 0;
  for (const id of priced) {
    const fp = fairPrice(id, tpl.defaultGrossMarginPct);
    ratioSum += safe((shop.sellingPrices[id] ?? fp) / fp, 1);
  }
  const avgRatio = priced.length > 0 ? ratioSum / priced.length : 1;
  const price = priceRatioScore(avgRatio);

  // 3) Raf Sürekliliği: karşılanamayan talep payı + raf doluluğu
  const asked = shop.todayUnitsSold + shop.todayUnmetCustomerDemand;
  const unmetShare = asked > 0 ? clamp(shop.todayUnmetCustomerDemand / asked, 0, 1) : 0;
  const used = [...stock.values()].reduce((a, b) => a + b, 0);
  const fill = clamp(used / Math.max(1, shop.shelfCapacity), 0, 1);
  const stockScore = clamp(100 * (0.75 * (1 - unmetShare) + 0.25 * Math.min(1, fill / 0.5)), 0, 100);

  // 4) Hizmet & Ortam: personel yeterliliği, eğitim, sigorta, küçük yükseltmeler
  const staffRatio =
    shop.ownerWorks && shop.staffCount <= 0 ? 0.6 : clamp(shop.staffCount / Math.max(1, shop.minStaffRequired), 0, 1);
  const trained = shop.staffCount > 0 ? clamp((shop.trainedStaff ?? 0) / shop.staffCount, 0, 1) : 0;
  const insured = shop.staffInsurance ? 1 : 0;
  const upgradeIds = new Set([...(shop.upgrades ?? []), ...Object.keys(shop.usedUpgrades ?? {})]);
  const upgradeShare = clamp(upgradeIds.size / 6, 0, 1);
  const w = SHOP_SERVICE_WEIGHTS;
  const service = clamp(
    100 * (w.staff * staffRatio + w.trained * trained + w.insurance * insured + w.upgrades * upgradeShare),
    0,
    100
  );

  const pillars: ShopRatingPillars = {
    VARIETY: Math.round(variety),
    PRICE: Math.round(price),
    STOCK: Math.round(stockScore),
    SERVICE: Math.round(service),
  };
  const score = (pillars.VARIETY + pillars.PRICE + pillars.STOCK + pillars.SERVICE) / 4;
  return { pillars, score: Number(score.toFixed(1)), stars: scoreToStars(score) };
}

/** Sütunun bir cümlelik durumu (karne penceresi). */
export function pillarSummaryTR(pillar: ShopRatingPillar, value: number): string {
  const good = value >= 80;
  const ok = value >= 55;
  switch (pillar) {
    case 'VARIETY':
      return good ? 'Raflarda her çeşit var.' : ok ? 'Bazı ürünler az kalmış.' : 'Birkaç çeşit rafta yok.';
    case 'PRICE':
      return good ? 'Fiyatlar adil.' : ok ? 'Fiyatlar biraz yüksek.' : 'Müşteriler fiyatı pahalı buluyor.';
    case 'STOCK':
      return good ? 'Raflar gün boyu dolu kaldı.' : ok ? 'Gün içinde bazı raflar boşaldı.' : 'Müşteriler boş rafa çarptı.';
    case 'SERVICE':
      return good ? 'Ekip ve dükkân çok iyi.' : ok ? 'Hizmet idare eder; yükseltmeler işe yarar.' : 'Çalışan yetmiyor ya da dükkân bakımsız.';
  }
}

/** Basit, tohumlu karma (motor sayı üretecine dokunmaz). */
export function reviewHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const REVIEW_NAMES = [
  'Ayşe K.', 'Mehmet T.', 'Zeynep A.', 'Ahmet Y.', 'Elif D.', 'Mustafa Ö.', 'Fatma S.', 'Emre B.',
  'Hatice G.', 'Burak Ç.', 'Selin E.', 'Hasan P.', 'Derya N.', 'Can U.', 'Merve İ.', 'Oğuz R.',
];

const PRAISE_TEXTS = [
  'Ne zaman gelsem aradığım her şey rafta, ortam da tertemiz.',
  'Fiyatlar makul, çalışanlar güler yüzlü. Mahallenin en iyisi!',
  'Hızlı ve düzenli. Arkadaşlarıma da tavsiye ettim.',
  'Her şey taze ve yerli yerinde, keyifle alışveriş yaptım.',
];
const OK_TEXTS = [
  'Genel olarak memnunum, birkaç küçük şey daha iyi olabilir.',
  'İhtiyacımı buldum, fena değil.',
  'Fiyat ve çeşit idare eder, tekrar gelirim.',
];

function pickStars(score: number, h: number): 1 | 2 | 3 | 4 | 5 {
  if (score < 35) return 1;
  if (score < 60) return 2;
  if (score < 75) return 3;
  if (score < 88) return h % 3 === 0 ? 5 : 4;
  return 5;
}

/** Tek bir yorum üretir: en zayıf sütun kötüyse şikâyet, iyiyse övgü. */
function buildReview(shop: ShopInstance, day: number, pillars: ShopRatingPillars, h: number, focus?: ShopRatingPillar): ShopCustomerReview {
  const tpl = SHOP_TEMPLATES[shop.shopType];
  const allowed = tpl?.allowedResourceIds ?? [];
  const stock = stockByResource(shop);
  const order: ShopRatingPillar[] = ['VARIETY', 'PRICE', 'STOCK', 'SERVICE'];
  const weakest = focus ?? order.reduce((a, b) => (pillars[b] < pillars[a] ? b : a), order[0]);
  const value = pillars[weakest];
  const authorName = REVIEW_NAMES[h % REVIEW_NAMES.length];
  const base = { id: `REV-${shop.shopId}-${day}-${h % 100000}`, day, authorName };

  if (value < 70) {
    const stars = pickStars(value, h);
    if (weakest === 'VARIETY' || weakest === 'STOCK') {
      const missing = allowed.find((id) => (stock.get(id) ?? 0) <= 0);
      const other = allowed.find((id) => (stock.get(id) ?? 0) > 0);
      const mName = missing ? RESOURCE_CATALOG[missing]?.nameTR : undefined;
      const oName = other ? RESOURCE_CATALOG[other]?.nameTR : undefined;
      const textTR = mName
        ? `${mName} almak için uğradım ama kalmamış${oName ? `, sadece ${oName.toLocaleLowerCase('tr-TR')} vardı` : ''}.`
        : 'Raflar yarı boştu, aradığımı bulamadım.';
      return { ...base, stars, pillar: weakest, textTR, actionHint: 'RESTOCK' };
    }
    if (weakest === 'PRICE') {
      return {
        ...base,
        stars,
        pillar: 'PRICE',
        textTR: 'Ürünler güzel ama fiyatlar mahalledeki diğer yerlere göre pahalı.',
        actionHint: 'PRICE',
      };
    }
    const understaffed = !(shop.ownerWorks && shop.staffCount <= 0) && shop.staffCount < shop.minStaffRequired;
    if (understaffed || (shop.ownerWorks && shop.staffCount <= 0)) {
      return { ...base, stars, pillar: 'SERVICE', textTR: 'Kasada tek kişi yetişemiyor, bayağı sıra bekledim.', actionHint: 'STAFF' };
    }
    return {
      ...base,
      stars,
      pillar: 'SERVICE',
      textTR: 'Dükkân biraz sade kalmış; tabela ve vitrin yenilense daha çok gelirim.',
      actionHint: 'UPGRADE',
    };
  }
  const avg = (pillars.VARIETY + pillars.PRICE + pillars.STOCK + pillars.SERVICE) / 4;
  const stars = pickStars(avg, h);
  const texts = stars >= 5 ? PRAISE_TEXTS : OK_TEXTS;
  return { ...base, stars, pillar: weakest, textTR: texts[(h >>> 5) % texts.length] };
}

/** Gün sonunda 1–2 yorum üretir (dükkân o gün satış yaptıysa ya da müşteri döndüyse). */
export function generateDailyShopReviews(shop: ShopInstance, day: number, pillars: ShopRatingPillars): ShopCustomerReview[] {
  if (shop.todayUnitsSold <= 0 && shop.todayUnmetCustomerDemand <= 0) return [];
  const h = reviewHash(`${shop.shopId}|${day}`);
  const out = [buildReview(shop, day, pillars, h)];
  if (h % 2 === 0) {
    const order: ShopRatingPillar[] = ['VARIETY', 'PRICE', 'STOCK', 'SERVICE'];
    const second = order[(h >>> 3) % order.length];
    const r = buildReview(shop, day, pillars, reviewHash(`${shop.shopId}|${day}|2`), second);
    if (r.textTR !== out[0].textTR) out.push(r);
  }
  return out;
}

/**
 * Gün kapanışı: memnuniyeti 4 sütun puanına doğru yumuşakça yaklaştırır ve yorumları ekler.
 * Dönen kademe Efsane ise çağıran günlük itibar bonusu verebilir.
 */
export function updateShopRatingAtDayClose(shop: ShopInstance, day: number): ShopStarTierDef {
  const rating = computeShopRating(shop);
  const prev = safe(shop.customerSatisfaction, 70);
  shop.customerSatisfaction = Number(clamp(prev + (rating.score - prev) * SHOP_RATING_BLEND, 0, 100).toFixed(1));
  if (!shop.isCompanyBranch) {
    const fresh = generateDailyShopReviews(shop, day, rating.pillars);
    if (fresh.length > 0) {
      shop.recentReviews = [...fresh, ...(shop.recentReviews ?? [])].slice(0, SHOP_REVIEWS_MAX);
    }
  }
  return getShopStarTier(shopStars(shop));
}
