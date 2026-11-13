/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useEffect,
  useState,
} from 'react';
import {
  Building2,
  Factory,
  FlaskConical,
  Landmark,
  Newspaper,
  Rocket,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  SimulationState,
} from '../../models/simulation';
import {
  CityBuildingId,
} from './gameTypes';

import {
  BorsaPanel,
} from './buildings/BorsaPanel';
import {
  BankaPanel,
} from './buildings/BankaPanel';
import {
  HaberMerkeziPanel,
} from './buildings/HaberMerkeziPanel';
import {
  OyuncuOfisiPanel,
} from './buildings/OyuncuOfisiPanel';
import {
  SirketMerkeziPanel,
} from './buildings/SirketMerkeziPanel';
import {
  FabrikaPanel,
} from './buildings/FabrikaPanel';
import {
  ArgeMerkeziPanel,
} from './buildings/ArgeMerkeziPanel';
import {
  HoldingMerkeziPanel,
} from './buildings/HoldingMerkeziPanel';

import type {
  BuildingDetailActions,
  BuildingDetailContentProps,
} from './buildings/buildingTypes';
export type { BuildingDetailActions };

/**
 * Seçilen binaya göre doğru paneli gösterir. Her panelin kendi durumu (form alanları, sekmeler) kendi dosyasındadır.
 */
export const BuildingDetailContent: React.FC<BuildingDetailContentProps> = (props) => {
  switch (props.buildingId) {
    case 'BORSA':
      return <BorsaPanel {...props} />;
    case 'BANKA':
      return <BankaPanel {...props} />;
    case 'HABER_MERKEZI':
      return <HaberMerkeziPanel {...props} />;
    case 'OYUNCU_OFISI':
      return <OyuncuOfisiPanel {...props} />;
    case 'SIRKET_MERKEZI':
      return <SirketMerkeziPanel {...props} />;
    case 'FABRIKA':
      return <FabrikaPanel {...props} />;
    case 'ARGE_MERKEZI':
      return <ArgeMerkeziPanel {...props} />;
    default:
      return <HoldingMerkeziPanel {...props} />;
  }
};

interface BuildingDetailSheetProps extends BuildingDetailActions {
  buildingId: CityBuildingId | null;
  state: SimulationState;
  initialCompanySubTab?: 'OZET' | 'URETIM' | 'CALISANLAR' | 'FINANS' | 'GELISIM';
  onClose: () => void;
  onOpenBuilding: (id: CityBuildingId) => void;
}

const BUILDING_SHEET_HEADERS: Record<
  CityBuildingId,
  {
    title: string;
    subtitle: string;
    Icon: React.ComponentType<{ className?: string }>;
    accentClass: string;
    iconBoxClass: string;
  }
> = {
  BORSA: {
    title: 'Borsa Binası & Emir Terminali',
    subtitle: 'Canlı hisse senedi alım-satımı, limit emirler ve emir defteri',
    Icon: TrendingUp,
    accentClass: 'border-t-4 border-t-emerald-600 bg-emerald-50/40',
    iconBoxClass: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  },
  BANKA: {
    title: 'Merkez Bankası & Hazine',
    subtitle: 'Nakit rezervleri, borç yükümlülükleri ve makroekonomik faizler',
    Icon: Landmark,
    accentClass: 'border-t-4 border-t-amber-500 bg-amber-50/40',
    iconBoxClass: 'bg-amber-100 border-amber-300 text-amber-800',
  },
  HABER_MERKEZI: {
    title: 'Haber Merkezi & Sektör Bülteni',
    subtitle: 'Gerçek zamanlı piyasa haberleri ve duyarlılık sönümlenmesi',
    Icon: Newspaper,
    accentClass: 'border-t-4 border-t-orange-500 bg-orange-50/40',
    iconBoxClass: 'bg-orange-100 border-orange-300 text-orange-800',
  },
  OYUNCU_OFISI: {
    title: 'Oyuncu Ofisi & Portföy Yönetimi',
    subtitle: 'Net varlık denklemi, portföy pozisyonları ve işlem geçmişi',
    Icon: Building2,
    accentClass: 'border-t-4 border-t-sky-600 bg-sky-50/40',
    iconBoxClass: 'bg-sky-100 border-sky-300 text-sky-800',
  },
  SIRKET_MERKEZI: {
    title: 'Şirket Arsası & Kurumsal Merkez',
    subtitle: 'Aşama 2 şirket kurulumu, sermaye aktarımı ve Halka Arz (IPO)',
    Icon: Rocket,
    accentClass: 'border-t-4 border-t-teal-600 bg-teal-50/40',
    iconBoxClass: 'bg-teal-100 border-teal-300 text-teal-800',
  },
  FABRIKA: {
    title: 'Organize Sanayi Fabrika Bölgesi',
    subtitle: 'Gün içi üretim kapasitesi, stok ve maliyet yönetimi',
    Icon: Factory,
    accentClass: 'border-t-4 border-t-amber-600 bg-amber-50/40',
    iconBoxClass: 'bg-amber-100 border-amber-300 text-amber-900',
  },
  ARGE_MERKEZI: {
    title: 'Teknokent Ar-Ge & İnovasyon Merkezi',
    subtitle: 'Günlük Ar-Ge bütçesi ve teknoloji kalite çarpanı',
    Icon: FlaskConical,
    accentClass: 'border-t-4 border-t-violet-600 bg-violet-50/40',
    iconBoxClass: 'bg-violet-100 border-violet-300 text-violet-800',
  },
  HOLDING_MERKEZI: {
    title: 'Holding Kuleleri & Devralma (M&A)',
    subtitle: 'Kontrol edilen bağlı ortaklıklar, sinerji ve %51+ devralma',
    Icon: ShieldCheck,
    accentClass: 'border-t-4 border-t-rose-700 bg-rose-50/40',
    iconBoxClass: 'bg-rose-100 border-rose-300 text-rose-900',
  },
};

export const BuildingDetailSheet: React.FC<BuildingDetailSheetProps> =
  React.memo((props) => {
    const { buildingId, onClose } = props;
    const [dragOffsetY, setDragOffsetY] = useState(0);
    const [dragStartY, setDragStartY] = useState<number | null>(null);

    useEffect(() => {
      if (!buildingId) {
        setDragOffsetY(0);
        setDragStartY(null);
        return;
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
          if (e.key === 'Backspace' && (activeTag === 'INPUT' || activeTag === 'TEXTAREA')) {
            return;
          }
          onClose();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [buildingId, onClose]);

    if (!buildingId) return null;

    const header = BUILDING_SHEET_HEADERS[buildingId];
    const HeaderIcon = header.Icon;

    const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
      setDragStartY(e.clientY);
    };

    const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragStartY === null) return;
      const deltaY = Math.max(0, e.clientY - dragStartY);
      setDragOffsetY(deltaY);
    };

    const handleDragEnd = () => {
      if (dragOffsetY > 60) {
        setDragOffsetY(0);
        setDragStartY(null);
        onClose();
      } else {
        setDragOffsetY(0);
        setDragStartY(null);
      }
    };

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={header.title}
        data-testid={`building-detail-sheet-${buildingId}`}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgba(18,28,68,.5)] p-0 sm:p-4"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: dragOffsetY > 0 ? `translate3d(0, ${dragOffsetY}px, 0)` : undefined,
          }}
          className={`w-full max-w-3xl max-h-[76vh] sm:max-h-[84vh] bg-[var(--g-bg)] rounded-t-[26px] sm:rounded-[26px] shadow-2xl flex flex-col overflow-hidden transition-transform duration-150`}
        >
          {/* Aşağı Sürüklenebilir Bottom Sheet Tutamağı ve Başlık Çubuğu */}
          <div
            data-testid="sheet-drag-handle"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            className="touch-none select-none cursor-grab active:cursor-grabbing bg-white sticky top-0 z-10 border-b border-[var(--g-line)]"
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 sm:hidden" />

            <div className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white" style={{ background: 'linear-gradient(160deg,var(--g-navy-600),var(--g-navy-800))' }}
                >
                  <HeaderIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="g-display text-lg font-extrabold leading-tight text-[var(--g-ink)] truncate">
                    {header.title}
                  </h2>
                  <p className="text-[13px] text-slate-500 truncate">
                    {header.subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="close-building-sheet-btn"
                aria-label="Bina Detay Penceresini Kapat"
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-[var(--g-surface-2)] flex items-center justify-center text-[var(--g-muted)] shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* İçerik */}
          <div className="p-4 overflow-y-auto flex-1">
            <BuildingDetailContent {...props} buildingId={buildingId} />
          </div>
        </div>
      </div>
    );
  });
