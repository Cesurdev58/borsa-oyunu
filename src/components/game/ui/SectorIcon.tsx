/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Borsa sektörleri için tutarlı, renkli ikon rozeti (emoji yerine).
 */
import React from 'react';
import {
  Atom,
  Building2,
  Cpu,
  Landmark,
  Pickaxe,
  Shield,
  ShoppingCart,
  Truck,
  Zap,
} from 'lucide-react';

const META: Record<string, { Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; bg: string; fg: string; label: string }> = {
  TEKNOLOJI: { Icon: Cpu, bg: '#e8ecfb', fg: '#2f4299', label: 'Teknoloji' },
  ENERJI: { Icon: Zap, bg: '#fff4d6', fg: '#b77900', label: 'Enerji' },
  FINANS: { Icon: Landmark, bg: '#e6f6ef', fg: '#15905a', label: 'Finans' },
  BIYOTEKNOLOJI: { Icon: Atom, bg: '#f3e9fd', fg: '#7b3fc4', label: 'Biyoteknoloji' },
  SAVUNMA: { Icon: Shield, bg: '#eaeef3', fg: '#3d4a5c', label: 'Savunma' },
  PERAKENDE: { Icon: ShoppingCart, bg: '#ffe9e8', fg: '#c93633', label: 'Perakende' },
  LOJISTIK: { Icon: Truck, bg: '#e3f4fb', fg: '#16799e', label: 'Lojistik' },
  MADENCILIK: { Icon: Pickaxe, bg: '#f4ece2', fg: '#8a5a2b', label: 'Madencilik' },
};

export function sectorLabel(sector: string): string {
  return META[sector]?.label ?? sector.charAt(0) + sector.slice(1).toLowerCase();
}

export const SectorIcon: React.FC<{ sector: string; size?: 'sm' | 'md' | 'lg' }> = ({ sector, size = 'md' }) => {
  const m = META[sector] ?? { Icon: Building2, bg: '#eef1f7', fg: '#66708a', label: sector };
  const box = size === 'lg' ? 'w-12 h-12 rounded-2xl' : size === 'sm' ? 'w-5 h-5 rounded-md' : 'w-10 h-10 rounded-xl';
  const ic = size === 'lg' ? 'w-6 h-6' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <span aria-hidden="true" className={`${box} shrink-0 inline-flex items-center justify-center`} style={{ background: m.bg, color: m.fg }}>
      <m.Icon className={ic} strokeWidth={2.4} />
    </span>
  );
};
