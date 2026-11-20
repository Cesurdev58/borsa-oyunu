/**
 * Etkileşimli Türkiye haritası (Faz 3). Yerel SVG; dış ağ ve harita SDK'sı yok.
 * - Tek parmak/fare sürükleme = kaydır, iki parmak/tekerlek = yakınlaştır.
 * - Şehir adları haritada yazılı durmaz (yalnızca ekran okuyucu etiketinde ve alt panelde).
 * - Gri işaret de tıklanabilirdir (mağaza yoksa bile şehir bilgisi açılır).
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CityId, TurkeyMapViewState } from '../../../models/cities';
import { MAP_HEIGHT } from '../../../data/cityDefinitions';
import { MAP_WIDTH } from '../../../data/cityBalance';
import { TURKEY_NEIGHBORS_PATH, TURKEY_OUTLINE_PATH } from '../../../data/turkeyMapGeometry';
import {
  MARKER_DOT_PX,
  MARKER_HIT_PX,
  clampMapView,
  markerAriaLabel,
  panByPixels,
  unitsPerPixel,
  viewBoxFor,
  zoomAtPoint,
  type MapMarkerModel,
} from './mapView';

interface MarkerProps {
  marker: MapMarkerModel;
  selected: boolean;
  /** 1 piksel = kaç harita birimi (yalnızca yakınlaştırma değişince değişir; sürüklemede sabit). */
  upp: number;
}

const CityMarker = memo(function CityMarker({ marker, selected, upp }: MarkerProps) {
  const r = (MARKER_DOT_PX / 2) * upp;
  const hit = (MARKER_HIT_PX / 2) * upp;
  const isHq = marker.markerState === 'HEADQUARTERS';
  const owned = marker.markerState !== 'EMPTY';
  return (
    <g
      data-testid={`turkey-city-marker-${marker.cityId}`}
      data-city-id={marker.cityId}
      data-marker-state={marker.markerState}
      data-has-issue={marker.hasIssue ? 'true' : 'false'}
      data-dimmed={marker.dimmed ? 'true' : 'false'}
      data-hit-px={MARKER_HIT_PX}
      role="button"
      tabIndex={0}
      aria-label={markerAriaLabel(marker)}
      aria-pressed={selected}
      style={{ cursor: 'pointer', outline: 'none', opacity: marker.dimmed && !selected ? 0.28 : 1 }}
    >
      {/* Görünmez dokunma alanı: en az 44×44 px */}
      <rect
        x={marker.x - hit}
        y={marker.y - hit}
        width={hit * 2}
        height={hit * 2}
        fill="transparent"
        data-testid={`turkey-city-hit-${marker.cityId}`}
      />
      {marker.hasIssue && (
        <circle
          cx={marker.x}
          cy={marker.y}
          r={r + 4 * upp}
          fill="none"
          stroke="var(--g-red, #dc2626)"
          strokeWidth={3 * upp}
          data-testid={`turkey-city-issue-${marker.cityId}`}
        />
      )}
      {isHq && (
        <circle
          cx={marker.x}
          cy={marker.y}
          r={r + (marker.hasIssue ? 8 : 4) * upp}
          fill="none"
          stroke="var(--g-gold, #f5b301)"
          strokeWidth={3 * upp}
        />
      )}
      {selected && (
        <circle cx={marker.x} cy={marker.y} r={r + 11 * upp} fill="none" stroke="var(--g-navy-600, #1e3a5f)" strokeWidth={2 * upp} strokeDasharray={`${4 * upp} ${3 * upp}`} />
      )}
      <circle
        cx={marker.x}
        cy={marker.y}
        r={r}
        fill={owned ? '#ffffff' : '#9ca3af'}
        stroke={owned ? 'var(--g-navy-700, #14304f)' : '#6b7280'}
        strokeWidth={1.5 * upp}
      />
    </g>
  );
});

export interface TurkeyMapProps {
  markers: MapMarkerModel[];
  view: TurkeyMapViewState;
  selectedCityId?: CityId;
  /** Hareket bitince (parmak kalkınca, tekerlek durunca) çağrılır: kamera kayda yazılır. */
  onViewCommit: (view: TurkeyMapViewState) => void;
  onSelectCity: (cityId: CityId | undefined) => void;
  /** Sunucu tarafı/test için sabit ölçü; verilmezse gerçek ölçü okunur. */
  fixedSize?: { width: number; height: number };
  /** Kamera dışarıdan (Ortala / Mağazalarıma Git) değişince değer değişir. */
  viewRevision?: number;
}

const DRAG_THRESHOLD_PX = 6;

export function TurkeyMap({ markers, view, selectedCityId, onViewCommit, onSelectCity, fixedSize, viewRevision = 0 }: TurkeyMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(fixedSize ?? { width: 390, height: 560 });
  useEffect(() => {
    if (fixedSize) return;
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixedSize]);

  const aspect = size.height / size.width;
  const [live, setLive] = useState<TurkeyMapViewState>(() => clampMapView(view, aspect));
  const liveRef = useRef(live);
  liveRef.current = live;
  // Dışarıdan gelen kamera (kayıttan okuma, Ortala) ya da ölçü değişimi.
  useEffect(() => {
    setLive(clampMapView(view, aspect));
  }, [view.panX, view.panY, view.zoom, aspect, viewRevision]);

  const vb = viewBoxFor(live, aspect);
  const upp = unitsPerPixel(live, size.width, aspect);
  // Sürüklemede upp sabit kalır → işaretler yeniden çizilmez (memo).
  const stableUpp = Math.round(upp * 1000) / 1000;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dragged: boolean; downCity: CityId | undefined; pinchDist: number }>({ dragged: false, downCity: undefined, pinchDist: 0 });
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const commit = useCallback(() => onViewCommit(liveRef.current), [onViewCommit]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const target = (e.target as Element).closest?.('[data-city-id]');
    gesture.current.downCity = (target?.getAttribute('data-city-id') as CityId | null) ?? undefined;
    if (pointers.current.size === 1) gesture.current.dragged = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      gesture.current.dragged = true;
    }
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch { /* yok say */ }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      if (!gesture.current.dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      gesture.current.dragged = true;
      pointers.current.set(e.pointerId, cur);
      setLive((v) => panByPixels(v, dx, dy, size.width, aspect));
    } else if (pointers.current.size === 2) {
      pointers.current.set(e.pointerId, cur);
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.current.pinchDist > 0 && dist > 0) {
        const rect = boxRef.current?.getBoundingClientRect();
        const fx = rect ? ((a.x + b.x) / 2 - rect.left) / rect.width : 0.5;
        const fy = rect ? ((a.y + b.y) / 2 - rect.top) / rect.height : 0.5;
        const ratio = dist / gesture.current.pinchDist;
        setLive((v) => zoomAtPoint(v, aspect, fx, fy, v.zoom * ratio));
      }
      gesture.current.pinchDist = dist;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const had = pointers.current.delete(e.pointerId);
    if (!had) return;
    if (pointers.current.size === 0) {
      if (!gesture.current.dragged) {
        // Dokunuş: işaret varsa seç, boşluksa paneli kapat.
        onSelectCity(gesture.current.downCity);
      } else {
        commit();
      }
      gesture.current.pinchDist = 0;
    } else if (pointers.current.size === 1) {
      gesture.current.pinchDist = 0;
    }
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0 && gesture.current.dragged) commit();
  };

  // wheel pasif olmayan dinleyiciyle bağlanır (sayfa kaymasını engellemek için).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setLive((v) => zoomAtPoint(v, aspect, fx, fy, v.zoom * factor));
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => onViewCommit(liveRef.current), 250);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
    };
  }, [aspect, onViewCommit]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const id = (e.target as Element).closest?.('[data-city-id]')?.getAttribute('data-city-id') as CityId | null;
    if (id) {
      e.preventDefault();
      onSelectCity(id);
    }
  };

  const markerNodes = useMemo(
    () =>
      markers.map((m) => (
        <CityMarker key={m.cityId} marker={m} selected={m.cityId === selectedCityId} upp={stableUpp} />
      )),
    [markers, selectedCityId, stableUpp]
  );

  return (
    <div
      ref={boxRef}
      data-testid="turkey-map"
      data-zoom={live.zoom.toFixed(3)}
      data-pan-x={live.panX.toFixed(1)}
      data-pan-y={live.panY.toFixed(1)}
      className="relative w-full h-full overflow-hidden touch-none select-none"
      style={{ background: 'var(--g-navy-900, #0b1f36)', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Türkiye haritası. Şehir işaretlerine dokunarak bilgi alabilirsin."
      >
        <rect x={-MAP_WIDTH} y={-MAP_HEIGHT} width={MAP_WIDTH * 3} height={MAP_HEIGHT * 3} fill="#0f2a47" />
        <path d={TURKEY_NEIGHBORS_PATH} fill="#1d3a5c" stroke="#2c4d75" strokeWidth={0.8 * Math.max(1, upp * 1.2)} fillRule="evenodd" />
        <path d={TURKEY_OUTLINE_PATH} fill="#2f5a45" stroke="#7fb59a" strokeWidth={1.2 * Math.max(1, upp * 1.2)} fillRule="evenodd" data-testid="turkey-outline" />
        {markerNodes}
      </svg>
    </div>
  );
}
