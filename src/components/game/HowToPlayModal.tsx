/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NASIL OYNANIR? rehberi: alt menüdeki "Rehber" düğmesiyle açılır.
 * Bölüm bölüm sekmeler, her bölümde kısa maddeler ve ilgili ekrana götüren bir düğme.
 * Sayılar oyunun ayar dosyalarından okunur; denge değişince metin kendiliğinden doğru kalır.
 */

import React, { useState } from 'react';
import {
  BookOpen,
  Briefcase,
  CandlestickChart,
  Coins,
  Landmark,
  Lightbulb,
  Rocket,
  Store,
  X,
} from 'lucide-react';
import {
  TEMPO_COMPANY_MINUTES,
  PRESTIGE_MIN_NET_WORTH,
  TEMPO_EARLY_MINUTES,
  MANAGER_MIN_SHOP_LEVEL,
  MARKET_BUY_MAX_OWNERSHIP_PCT,
  WEALTH_TAX_ANNUAL_RATE,
  WEALTH_TAX_FREE_AMOUNT,
  WEALTH_TAX_PERIOD_DAYS,
  OWNER_STAFF_CAPACITY,
  FIRST_EMPLOYEE_HIRE_FEE_BUFE,
  RECOMMENDED_WORKING_CAPITAL_BUFE,
} from '../../data/gameBalance';
import { PROGRESSION_RULES } from '../../engine/ProgressionRules';
import { DECISION_LIFETIME_DAYS } from '../../engine/DecisionEventEngine';
import { CARGO_SHIPPING_CUT, INSURANCE_CUSTOMERS_PCT, TRAINING_BASKET_PCT } from '../../data/cityServices';
import type { CityBuildingId, GameBottomTab } from './gameTypes';

interface HowToPlayModalProps {
  open: boolean;
  onClose: () => void;
  onGoTab: (tab: GameBottomTab) => void;
  onOpenBuilding: (id: CityBuildingId) => void;
  formatCurrency: (v: number) => string;
  /** Açılış rehberini baştan başlatır (kayıttaki onboarding sıfırlanır) */
  onRestartGuide?: () => void;
}

type SectionId = 'start' | 'market' | 'shop' | 'company' | 'holding' | 'money' | 'tips';

interface Section {
  id: SectionId;
  label: string;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  points: string[];
  go?: { label: string; tab?: GameBottomTab; building?: CityBuildingId };
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  open,
  onClose,
  onGoTab,
  onOpenBuilding,
  formatCurrency,
  onRestartGuide,
}) => {
  const [active, setActive] = useState<SectionId>('start');
  if (!open) return null;

  const fc = (v: number) => formatCurrency(v).replace(/,00$/, '');
  const companyAt = fc(PROGRESSION_RULES.entrepreneurNetWorth);

  const sections: Section[] = [
    {
      id: 'start',
      label: 'Başlangıç',
      title: 'Oyunun amacı',
      Icon: Rocket,
      points: [
        `${fc(PROGRESSION_RULES.defaultNetWorth)} ile başlarsın. Amacın küçük parayı büyütüp bir holding patronu olmak.`,
        `Yol şöyle: Borsayı tanı (bir hisse al, başka sektörden de al, bir hisseni sat) → dükkân aç → toplam varlığın ${companyAt} olunca şirket kur → rakip şirketleri satın alıp holding ol.`,
        'Ekranın üstündeki "Sıradaki hedef" şeridi o an ne yapman gerektiğini söyler. "Git" düğmesi seni oraya götürür. Hedefi bitirince altın düğmeye dokun, ödül parası cebine girer.',
        'Üstteki para kutusuna dokununca "Zenginler listesi"ni açabilirsin. Şehrin en zenginleri arasında kaçıncı olduğunu ve bir üsttekine ne kadar kaldığını gösterir. Birini geçince kutlama çıkar.',
        `Başlangıç hızlıdır: şirket kurana kadar bir oyun günü ${TEMPO_EARLY_MINUTES} gerçek dakika, şirketin halka açılana kadar ${TEMPO_COMPANY_MINUTES} dakika sürer. Sonra Ayarlar'da seçtiğin uzunluk (15 dk) geçerli olur. Sağ alttaki düğmeyle zamanı 2 kat hızlandırabilirsin. Uygulama kapalıyken oyun en fazla yaklaşık 2 gerçek saat ilerler.`,
        'Üstteki para kutusuna dokununca toplam varlığını görürsün. Zil bildirimleri, yıldız ise hangi aşamada olduğunu gösterir.',
        'Gün gece 00:00\'da döner. O an sol altta altın "Gün raporu" çıkar: dokununca şirketin, dükkânların ve borsanın o gün ne kazandırdığını görürsün.',
      ],
      go: { label: 'Haritaya git', tab: 'city' },
    },
    {
      id: 'market',
      label: 'Borsa',
      title: 'Borsada para kazanmak',
      Icon: CandlestickChart,
      points: [
        'Bir hisseye dokun, kaç adet (lot) alacağını − / + ile seç, sonra AL ya da SAT de.',
        'Borsa her gün 10:00–18:00 arası açıktır. Kapalıyken verdiğin emir borsa açılınca gerçekleşir.',
        '"Hedef emir" kutusunda bir fiyat yazarsan, hisse o fiyata gelince kendiliğinden alınır ya da satılır.',
        '"Varlıklarım" kutusu toplam paranı ve hangi hissede ne kazandığını, "İşlem geçmişi" yaptığın her alım-satımı gösterir.',
        'Fiyatlar haberlerle oynar. Haberler sekmesinde her haberin hangi hisseyi "yükselttiği" ya da "düşürdüğü" yazar. Ama dikkat: piyasa bazen haberi zaten bekliyordur ya da ters tepki verir.',
        'Ayda bir kadar "SON DAKİKA" olayı çıkar: savaş, salgın, faiz kararı, petrol krizi gibi. Bazı sektörleri günlerce yükseltir, bazılarını düşürür. Kartta hangisinin yükseleceği yazar.',
        'Bazı şirketler temettü öder: hissen varsa 10 günde bir hesabına para gelir.',
        'Paranı tek hisseye yatırma; farklı sektörlere dağıtırsan bir düşüş seni batırmaz.',
        '"Portföy yöneticisi" tutarsan, kenarda tutmak istediğin paranın fazlasını her gün sonunda bütün şirketlere eşit yatırır. Boşta duran para da çalışır.',
        `Bir şirketin en fazla %${MARKET_BUY_MAX_OWNERSHIP_PCT}'unu borsadan alabilirsin. Fazlası için Holding'den devralma teklifi gerekir.`,
      ],
      go: { label: 'Borsaya git', tab: 'market' },
    },
    {
      id: 'shop',
      label: 'Dükkân',
      title: 'Dükkân işletmek',
      Icon: Store,
      points: [
        'Borsada bir hisse alıp, başka bir sektörden de alıp, bir hisseni satıp piyasayı bir gün izleyince Dükkân sekmesinden ilk dükkânını açarsın. Büfe en ucuzu, galeri en pahalısı.',
        `İlk dükkânın büfeyse onu önce kendin çalıştırırsın (müşteri kapasitesi %${Math.round(OWNER_STAFF_CAPACITY * 100)}). Yönet → Çalışanlar'dan ilk çalışanını ${FIRST_EMPLOYEE_HIRE_FEE_BUFE.toLocaleString('tr-TR')} ₺ ile işe alınca dükkân tam kapasiteye çıkar. Dükkân açarken önerilen işletme sermayesini (büfe için ${RECOMMENDED_WORKING_CAPITAL_BUFE.toLocaleString('tr-TR')} ₺) elinde bırak; altına inersen uyarı çıkar.`,
        'Her dükkânın kendi kasası vardır. Mal alımı ve maaşlar oradan ödenir. Kasa azalınca cebinden para koy, kâr birikince "Kâr al" de.',
        'Raf boşsa satış olmaz. "Rafları doldur" en ucuz toptancıdan mal ısmarlar. Mal birkaç günde gelir; gelene kadar "Yolda" yazar.',
        'Fiyat, çalışan ve dükkân büyütme için dükkân kartındaki "Yönet" düğmesine dokun.',
        'Dükkân sekmesinin en üstündeki şehir düğmesi bulunduğun şehrin adını gösterir. Dokununca varlığın olan şehirler açılır; seçtiğin şehrin dükkânları aşağıda listelenir. Şirket sekmesinde de aynı düğmeyle şehirdeki şirket şubelerini görürsün.',
        'Dükkân sekmesinin altındaki "Ek geliştirmeler" düğmesi altı yardımcı hizmeti açar (ikinci el pazarı, belediye, güneş paneli, akademi, sağlık sigortası, lojistik). İlk dükkânınla kullanılır.',
        'Her dükkân türünün çalışma saati vardır (büfe 07:00–23:00, galeri 09:00–19:00 gibi). Dükkân açıkken satış gün boyu parça parça gelir, para hemen dükkân kasasına girer; kira ve maaş gece yarısı düşer.',
        'Olağanüstü olaylar dükkânları da etkiler: savaşta galeriye daha az, markete daha çok müşteri gelir, toptancı fiyatları artar. Etkisi yaklaşık bir hafta sürer.',
        'Yönet → Geliştir ekranında seviye yükseltmenin yanında 6 küçük yükseltme var (tabela, vitrin, ikinci kasa, reklam…). Her biri "+%3 müşteri" gibi etkisini yazar; pahalı olanlar dükkân seviyesi yükselince açılır.',
        `${MANAGER_MIN_SHOP_LEVEL}. seviyeye gelen dükkâna müdür tutabilirsin. Rafları kendisi doldurur, kârı sana gönderir; karşılığında kârın biraz azalır.`,
        'Aynı türden çok dükkân açma, müşteriyi paylaşırlar. Farklı türler açmak daha kârlı.',
        'Ek geliştirmeler → İkinci El Pazarı\'nda fazla malını hemen satabilirsin (alış fiyatının altında) ve ucuz ikinci el eşya alabilirsin: yenisinin yarı fiyatı, ama 60 gün sonra eskir.',
        'Ek geliştirmeler → Belediye\'de mahalle projelerine katkı verirsen bütün dükkânlarına kalıcı müşteri ve itibar gelir. Güneş paneli bölümünden dükkânına güneş paneli kurarsan günlük giderin %20 azalır.',
        `Ek geliştirmeler → Akademi'de çalışanlarını eğit: bir kez ödersin, müşteriler %${TRAINING_BASKET_PCT} daha çok harcar. Yeni işe aldığın çalışan eğitimsiz gelir, onu da eğitmen gerekir.`,
        `Ek geliştirmeler → Sağlık sigortası'nda çalışanlarını sigortala: günlük küçük bir prim karşılığında +%${INSURANCE_CUSTOMERS_PCT} müşteri gelir, çalışanların zam istemez ve rakibe gitmez.`,
        `Ek geliştirmeler → Lojistik'te kargo anlaşması yap: siparişlerin %${Math.round(CARGO_SHIPPING_CUT * 100)} daha ucuz nakliyeyle ve 1 gün erken gelir. En çok manav, market ve galeriye değer.`,
        `Ara sıra bir karar kartı çıkar (festival, denetim gibi). ${DECISION_LIFETIME_DAYS} gün içinde seçmezsen ikinci seçenek seçilmiş sayılır.`,
      ],
      go: { label: 'Dükkânlarıma git', tab: 'portfolio' },
    },
    {
      id: 'company',
      label: 'Şirket',
      title: 'Şirket kurmak ve büyütmek',
      Icon: Briefcase,
      points: [
        `Toplam varlığın ${companyAt} olunca kendi şirketini kurabilirsin. Ya da en az 2 dükkânın varken dükkânlarını şirkete dönüştürürsün.`,
        'Önce sektör seçersin. Hızlı büyüyen sektörler kolaydır; yavaş olanların rakipleri ucuzdur. Seçim ekranı her birinin artısını ve dikkat edilecek yanını yazar.',
        'Şirketin ürün üretip satar. Fabrikayı "Üretim" sekmesinden büyütürsün; yatırım birkaç günde biter.',
        'Kaç ürün üreteceğini çalışan sayısı belirler ("Ekip" sekmesi). Satamayacağın kadar çalışan, boşa maaş demektir.',
        'Her sektörün pazarı sınırlıdır. Özet ekranındaki "Pazardaki payın" kartı ne kadar satabileceğini gösterir. Pazar dolunca fabrikayı büyütmek işe yaramaz; rakip devralman gerekir.',
        'Şirketin parası şirket kasasındadır. Cebine almak için "Para" sekmesinden temettü dağıtırsın (%10 vergi kesilir).',
        'Şirket yeterince büyüyünce halka arz edip hisselerini borsada satarak büyük para toplayabilirsin ("Gelişim" sekmesi).',
      ],
      go: { label: 'Şirketime git', tab: 'company' },
    },
    {
      id: 'holding',
      label: 'Holding',
      title: 'Rakipleri satın almak',
      Icon: Landmark,
      points: [
        `Bir rakip şirketin en az %${PROGRESSION_RULES.holdingStakeOwnershipPct}'ini alınca Holding binası açılır.`,
        "Bir şirketin %51'ini devralınca o şirket senin olur ve her gün kârından pay alırsın.",
        'Kendi sektöründeki rakibi devralırsan daha iyi: onun müşterileri de sana açılır, şirketin daha çok satar.',
        'Holding ekranı devralmanın yaklaşık bedelini ve sana günlük ne kazandıracağını gösterir.',
        'Devralma parası cebinden çıkar. Önce şirketinden temettüyle para çekmen gerekebilir.',
        `Toplam varlığın ${fc(PRESTIGE_MIN_NET_WORTH)}'yi geçince Zenginler listesinden "Yeni şehirde başla" diyebilirsin: her şey bu şehirde kalır, sen sıfırdan başlarsın ama bıraktığın servet kadar kalıcı yıldız kazanırsın. Her yıldız başlangıç paranı, dükkân müşterini ve hedef ödüllerini artırır.`,
      ],
      go: { label: "Holding'e git", building: 'HOLDING_MERKEZI' },
    },
    {
      id: 'money',
      label: 'Para ve vergi',
      title: 'Kasalar, kredi ve vergi',
      Icon: Coins,
      points: [
        'Üç ayrı kasan var: cebin, dükkân kasaları ve şirket kasası. Aralarında alt menüdeki Banka sekmesinden para taşıyabilirsin (ilk hisseni alınca açılır).',
        'Banka kredi verir. Şirketin yoksa bireysel kredi pahalıdır; borcu zamanında ödemezsen faiz büyür.',
        'Şirket kârının bir kısmı vergiye gider. Kâr büyüdükçe vergi oranı %25\'ten yukarı çıkar.',
        `Servet vergisi: nakdin ve hisselerin toplamı ${fc(WEALTH_TAX_FREE_AMOUNT)}'yi geçerse, fazlasından yılda %${Math.round(WEALTH_TAX_ANNUAL_RATE * 100)} alınır (${WEALTH_TAX_PERIOD_DAYS} günde bir). Büyük parayı boşta tutmak yerine yatırıma çevir.`,
        'Şirketten "yönetici maaşı" olarak günde sınırlı para çekebilirsin. Büyük para ancak temettüyle, kâr kadar çekilir.',
        'Para kutusuna dokun → "Lüks alışveriş": daire, araba, villa, yat, jet, ada. Her biri ticari itibarını artırır; itibar dükkânlarına daha çok müşteri getirir ve şirketleşmek için en az 60 gerekir. Lüks alımlar toplam varlığa sayılmaz.',
      ],
      go: { label: "Banka'ya git", building: 'BANKA' },
    },
    {
      id: 'tips',
      label: 'İpuçları',
      title: 'Kısa ipuçları',
      Icon: Lightbulb,
      points: [
        'Takıldığında "Sıradaki hedef" şeridine bak.',
        'Rafları hep dolu tut: boş raf, kaçan müşteri demektir.',
        'Karar kartlarını kaçırma; cevapsız kart çoğu zaman kötü sonuçlanır.',
        'Borsa düşerken panikle satma; iyi şirketler toparlanır.',
        'Küçük "?" işaretlerine dokunursan o kutunun ne olduğu tek cümleyle yazar.',
      ],
    },
  ];

  const current = sections.find((s) => s.id === active) ?? sections[0];
  const { Icon } = current;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nasıl oynanır?"
      data-testid="how-to-play-modal"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-[rgba(18,28,68,.55)]"
      onClick={onClose}
    >
      <div
        className="g-rise w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-[var(--g-bg)] rounded-t-3xl sm:rounded-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 pt-4 pb-3 text-white"
          style={{ background: 'linear-gradient(180deg, var(--g-navy-800), var(--g-navy-900))' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-2xl bg-[var(--g-gold)] text-[#3a2600] flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </span>
              <h2 className="g-display text-xl font-extrabold">Nasıl oynanır?</h2>
            </div>
            <button
              type="button"
              aria-label="Kapat"
              data-testid="how-to-play-close"
              onClick={onClose}
              className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto pb-1" role="tablist">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === active}
                data-testid={`how-to-play-tab-${s.id}`}
                onClick={() => setActive(s.id)}
                className={`shrink-0 min-h-[40px] px-3.5 rounded-full text-[13px] font-extrabold transition-colors ${
                  s.id === active
                    ? 'bg-[var(--g-gold)] text-[#3a2600]'
                    : 'bg-white/10 text-white/75'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid={`how-to-play-section-${current.id}`}>
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-[var(--g-navy-800)]">
              <Icon className="w-5 h-5" />
            </span>
            <h3 className="g-display text-lg font-extrabold text-[var(--g-ink)]">{current.title}</h3>
          </div>
          <ol className="space-y-2">
            {current.points.map((p, i) => (
              <li key={i} className="g-card p-3 flex gap-3 text-sm text-[var(--g-ink)] leading-snug">
                <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--g-navy-800)] text-white text-[13px] font-extrabold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
          {current.go && (
            <button
              type="button"
              data-testid="how-to-play-go-btn"
              onClick={() => {
                onClose();
                if (current.go!.tab) onGoTab(current.go!.tab);
                if (current.go!.building) {
                  // Bina kilitliyse şehirde vurgulanır ve açılma koşulu görünür
                  onGoTab('city');
                  onOpenBuilding(current.go!.building);
                }
              }}
              className="g-btn g-btn-navy w-full min-h-[52px]"
            >
              {current.go.label}
            </button>
          )}
          {onRestartGuide && (
            <button
              type="button"
              data-testid="how-to-play-restart-guide-btn"
              onClick={onRestartGuide}
              className="g-btn g-btn-secondary w-full min-h-[48px]"
            >
              Açılış rehberini yeniden başlat
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
