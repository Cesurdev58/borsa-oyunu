/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 3 & 10: HABER VE DUYARLILIK MOTORU (NewsEngine)
 * Zamanla azalan haber etkisi: sentimentImpact(age) = initialImpact * exp(-decayRate * age)
 * Sektör haberleri sektördeki şirketleri kendi newsSensitivity katsayılarıyla etkiler.
 */

import { MarketStock, SectorId } from '../models/market';
import { NewsEvent } from '../models/news';
import { RandomEngine } from './RandomEngine';

export interface NewsTemplate {
  sector: SectorId | 'GENEL';
  headline: string;
  summary: string;
  baseImpact: number;
  decayRate: number;
}

export const NEWS_TEMPLATES: readonly NewsTemplate[] = [
  {
    sector: 'TEKNOLOJI',
    headline: 'Yerli Veri Merkezi ve Yapay Zeka Çip Teşvik Paketi Açıklandı',
    summary: 'Bulut bilişim ve siber güvenlik şirketlerine %40 vergi indirimi ve Ar-Ge hibesi sağlandı.',
    baseImpact: 0.014,
    decayRate: 0.28,
  },
  {
    sector: 'BIYOTEKNOLOJI',
    headline: 'Moleküler Kanser İlacı Faz-3 Klinik Testlerinde %91 Başarı Sağladı',
    summary: 'Uluslararası sağlık otoriteleri hızlı onay sürecini başlattı; biyoteknoloji hisselerine talep arttı.',
    baseImpact: 0.016,
    decayRate: 0.25,
  },
  {
    sector: 'ENERJI',
    headline: 'Karadeniz ve Ege Rüzgar Koridorunda Kapasite Artışı Onaylandı',
    summary: 'Yenilenebilir enerji santrallerine döviz bazlı alım garantisi süresi 5 yıl uzatıldı.',
    baseImpact: 0.011,
    decayRate: 0.3,
  },
  {
    sector: 'SAVUNMA',
    headline: 'Savunma Sanayi Şirketlerinden 1.8 Milyar Dolarlık İhracat Sözleşmesi',
    summary: 'Radar, elektro-optik ve İHA sistemleri için uluslararası teslimat takvimi öne çekildi.',
    baseImpact: 0.015,
    decayRate: 0.27,
  },
  {
    sector: 'FINANS',
    headline: 'Merkez Bankası Zorunlu Karşılık Oranlarında Likidite Sıkılaştırmasına Gitti',
    summary: 'Kredi büyüme tavanları daraltıldı, kısa vadeli fonlama maliyetlerinde artış beklentisi oluştu.',
    baseImpact: -0.0147,
    decayRate: 0.38,
  },
  {
    sector: 'MADENCILIK',
    headline: 'Batarya Sınıfı Lityum ve Nadir Toprak Element Fiyatlarında Küresel Ralli',
    summary: 'Elektrikli araç batarya üreticilerinin uzun vadeli tedarik anlaşmaları maden marjlarını yükseltti.',
    baseImpact: 0.013,
    decayRate: 0.3,
  },
  {
    sector: 'LOJISTIK',
    headline: 'Küresel Konteyner Navlun Endeksi ve Liman İşlem Hacmi %14 Yükseldi',
    summary: 'Doğu-Batı ticaret koridorundaki yoğunluk deniz ve hava kargo birim gelirlerini artırdı.',
    baseImpact: 0.01,
    decayRate: 0.32,
  },
  {
    sector: 'PERAKENDE',
    headline: 'Tüketici Güven Endeksi ve E-Ticaret Sepet Ortalaması Beklentileri Aştı',
    summary: 'Organize perakende zincirleri çeyreklik mağaza açılış hedeflerini yukarı yönlü revize etti.',
    baseImpact: 0.009,
    decayRate: 0.33,
  },
  {
    sector: 'GENEL',
    headline: 'Uluslararası Kredi Derecelendirme Kuruluşu Türkiye Görünümünü Pozitife Çevirdi',
    summary: 'Yabancı kurumsal fonların Borsa İstanbul pay piyasasına net girişi son 3 yılın zirvesine ulaştı.',
    baseImpact: 0.012,
    decayRate: 0.25,
  },
  {
    sector: 'TEKNOLOJI',
    headline: 'Küresel Yarı İletken Tedarik Zincirinde Kısa Vadeli Gecikme Uyarısı',
    summary: 'Donanım teslimat sürelerinin uzaması teknoloji şirketlerinde kısa süreli kar satışlarına yol açtı.',
    baseImpact: -0.02,
    decayRate: 0.4,
  },
  {
    sector: 'ENERJI',
    headline: 'Spot Elektrik Piyasasında Mevsimsel Bakım Nedeniyle Üretim Kesintisi',
    summary: 'Bazı enerji santrallerinde planlı bakım çalışmaları haftalık üretim miktarını sınırladı.',
    baseImpact: -0.0154,
    decayRate: 0.42,
  },
  {
    sector: 'FINANS',
    headline: 'Dijital Bankacılık ve Ödeme Sistemleri İşlem Hacminde Rekor Çeyrek',
    summary: 'Fintech ve bankacılık komisyon gelirleri yıllık bazda reel olarak %28 büyüme kaydetti.',
    baseImpact: 0.012,
    decayRate: 0.31,
  },
  // --- Olumsuz haberler: olumlu haberlerle dengeli olsun diye eklendi ---
  // (Eskiden 12 şablonun 9'u olumluydu; haber etkisi her gün getiri olarak işlendiği için borsa yılda yaklaşık 2 katına çıkıyordu.
  //  Her sektörde olumlu ve olumsuz haberin toplam etkisi (baseImpact / decayRate) artık eşittir: haber piyasaya hareket katar, tek yönlü bir yükseliş üretmez.
  //  Yeni şablon eklerken bu dengeyi koru: src/tests/market/newsBalance.test.ts bunu denetler.)
  {
    sector: 'BIYOTEKNOLOJI',
    headline: 'Faz-3 Klinik Çalışmada Beklenmeyen Yan Etki Raporlandı',
    summary: 'Sağlık otoritesi çalışmayı askıya aldı; biyoteknoloji hisselerinde satış baskısı oluştu.',
    baseImpact: -0.0166,
    decayRate: 0.26,
  },
  {
    sector: 'SAVUNMA',
    headline: 'Büyük Savunma İhracat Sözleşmesi İptal Edildi',
    summary: 'Alıcı ülkenin bütçe kısıtı nedeniyle sipariş iptal edildi; sektör şirketlerinin gelir beklentileri düştü.',
    baseImpact: -0.0156,
    decayRate: 0.28,
  },
  {
    sector: 'MADENCILIK',
    headline: 'Lityum ve Nadir Toprak Fiyatlarında Sert Düzeltme',
    summary: 'Küresel talep beklentilerinin zayıflaması fiyatları geriletti; madencilik marjları baskı altında.',
    baseImpact: -0.013,
    decayRate: 0.3,
  },
  {
    sector: 'LOJISTIK',
    headline: 'Büyük Limanlarda Grev ve Yoğunluk Nedeniyle Sevkiyatlar Aksadı',
    summary: 'Konteyner bekleme süreleri uzadı; lojistik şirketlerinin maliyetleri arttı.',
    baseImpact: -0.0103,
    decayRate: 0.33,
  },
  {
    sector: 'PERAKENDE',
    headline: 'Tüketici Güven Endeksi Beklentilerin Altında Geldi',
    summary: 'Hanehalkı harcama eğilimi geriledi; perakende satış beklentileri aşağı yönlü revize edildi.',
    baseImpact: -0.0093,
    decayRate: 0.34,
  },
  {
    sector: 'GENEL',
    headline: 'Uluslararası Derecelendirme Kuruluşu Türkiye Görünümünü Negatife Çevirdi',
    summary: 'Risk primi yükseldi; yabancı yatırımcı çıkışı endekslerde genel satış baskısı yarattı.',
    baseImpact: -0.0125,
    decayRate: 0.26,
  },
];

export class NewsEngine {
  /**
   * Mevcut haberlerin etkisini yaşlarına göre üstel olarak azaltır:
   * sentimentImpact(age) = initialImpact * exp(-decayRate * age)
   */
  public static decayExistingNews(newsFeed: NewsEvent[], currentDay: number): NewsEvent[] {
    return newsFeed.map((event) => {
      const age = Math.max(0, currentDay - event.day);
      const decayedImpact = Number(
        (event.initialImpact * Math.exp(-event.decayRate * age)).toFixed(6)
      );
      return {
        ...event,
        sentimentImpact: decayedImpact,
      };
    });
  }

  /**
   * Günlük yeni bir haber üretir ve hisselerin duyarlılık skorlarını günceller.
   */
  public static generateDailyNews(
    day: number,
    stocks: MarketStock[],
    rng: RandomEngine
  ): NewsEvent {
    const template = rng.choose(NEWS_TEMPLATES);
    const jitter = (rng.uniform() - 0.5) * 0.004;
    const initialImpact = Number((template.baseImpact + jitter).toFixed(5));

    // %30 ihtimalle ilgili sektördeki spesifik bir şirketi de hedef al
    let targetTicker: string | undefined;
    if (template.sector !== 'GENEL' && rng.uniform() < 0.35) {
      const candidates = stocks.filter((s) => s.sector === template.sector);
      if (candidates.length > 0) {
        targetTicker = rng.choose(candidates).ticker;
      }
    }

    return {
      id: `NEWS-D${day}-${rng.integer(100, 999)}`,
      day,
      headline: template.headline,
      summary: template.summary,
      sector: template.sector,
      targetTicker,
      initialImpact,
      sentimentImpact: initialImpact,
      decayRate: template.decayRate,
    };
  }

  /**
   * Tüm aktif haberlerin yaşlandırılmış etkisini her şirketin kendi newsSensitivity
   * ağırlığıyla birleştirerek hissenin güncel sentimentScore değerini hesaplar.
   */
  public static updateStockSentimentsFromNews(
    stocks: MarketStock[],
    newsFeed: NewsEvent[],
    currentDay: number
  ): void {
    const recentNews = newsFeed.filter((n) => currentDay - n.day <= 15);

    for (const stock of stocks) {
      let cumulativeSentiment = 0;
      for (const news of recentNews) {
        const age = Math.max(0, currentDay - news.day);
        const decayed = news.initialImpact * Math.exp(-news.decayRate * age);

        if (news.targetTicker && news.targetTicker === stock.ticker) {
          cumulativeSentiment += decayed * stock.newsSensitivity * 1.35;
        } else if (news.sector === stock.sector) {
          cumulativeSentiment += decayed * stock.newsSensitivity;
        } else if (news.sector === 'GENEL') {
          cumulativeSentiment += decayed * (0.65 + 0.35 * stock.newsSensitivity);
        }
      }

      stock.sentimentScore = Number(
        Math.max(-0.045, Math.min(0.045, cumulativeSentiment)).toFixed(6)
      );
    }
  }
}
