/**
 * Harita çökerse oyun beyaz ekranda kalmasın: hata konsola yazılır, fallback sayacı artar
 * ve eski 3D şehir açılır (Faz 11 acil durum çıkışı).
 */
import React from 'react';
import { recordMapFallback } from '../../../data/featureFlags';

interface Props {
  children: React.ReactNode;
  onFallback: () => void;
}

export class MapErrorBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    recordMapFallback('error', error);
    this.props.onFallback();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
