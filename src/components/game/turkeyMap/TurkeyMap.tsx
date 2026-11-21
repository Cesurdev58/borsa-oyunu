/**
 * Etkileşimli Türkiye haritası (Faz 3). Yerel SVG; dış ağ ve harita SDK'sı yok.
 * - Tek parmak/fare sürükleme = kaydır, iki parmak/tekerlek = yakınlaştır.
 * - 81 ilin gerçek sınırları poligon olarak çizilir (Natural Earth, kamu malı); ilin üzerine dokunmak ilini seçer.
 * - İl adları haritada yazılı durmaz (yalnızca ekran okuyucu etiketinde ve alt panelde).
 * - Mağazasız (gri) il de tıklanabilirdir (mağaza yoksa bile il bilgisi açılır).
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CityId, TurkeyMapViewState } from '../../../models/cities';
import { MAP_HEIGHT } from '../../../data/cityDefinitions';
import { MAP_WIDTH } from '../../../data/cityBalance';
import { TURKEY_NEIGHBORS_PATH } from '../../../data/turkeyMapGeometry';
import { TURKEY_PROVINCE_PATHS } from '../../../data/turkeyProvinceGeometry';
import {
  clampMapView,
  markerAriaLabel,
  panByPixels,
  unitsPerPixel,
  viewBoxFor,
  zoomAtPoint,
  type MapMarkerModel,
} from './mapView';

interface ProvinceProps {
  marker: MapMarkerModel;
  selected: boolean;
}

/** İl poligonu: dokunulabilir, rengi duruma göre (CSS sınıfı; üzerine gelince hafif vurgu `index.css` içinde). */
const Province = memo(function Province({ marker, selected }: ProvinceProps) {
  const owned = marker.markerState !== 'EMPTY';
  return (
    <g
      data-testid={`turkey-city-marker-${marker.cityId}`}
      data-city-id={marker.cityId}
      data-marker-state={marker.markerState}
      data-has-issue={marker.hasIssue ? 'true' : 'false'}
      data-dimmed={marker.dimmed ? 'true' : 'false'}
      data-selected={selected ? 'true' : 'false'}
      role="button"
      tabIndex={0}
      aria-label={markerAriaLabel(marker)}
      aria-pressed={selected}
      style={{ cursor: 'pointer', outline: 'none', opacity: marker.dimmed && !selected ? 0.35 : 1 }}
    >
      <path
        d={TURKEY_PROVINCE_PATHS[marker.cityId]}
        className={`turkey-province ${owned ? 'is-owned' : 'is-empty'}${selected ? ' is-selected' : ''}`}
        fillRule="evenodd"
        data-testid={`turkey-province-${marker.cityId}`}
      />
    </g>
  );
});

/**
 * Üst katman: altın merkez kenarlığı, kırmızı sorun kenarlığı ve seçili il çizgisi komşu ilin altında kalmasın diye
 * ayrı çizilir. Dokunmayı engellemez (pointer-events: none).
 */
const ProvinceOutline = memo(function ProvinceOutline({ marker, selected, upp }: ProvinceProps & { upp: number }) {
  const isHq = marker.markerState === 'HEADQUARTERS';
  if (!isHq && !marker.hasIssue && !selected) return null;
  const d = TURKEY_PROVINCE_PATHS[marker.cityId];
  const base = { d, fill: 'none', fillRule: 'evenodd' as const, vectorEffect: 'non-scaling-stroke' as const, strokeLinejoin: 'round' as const, pointerEvents: 'none' as const };
  const badge = 7 * upp;
  return (
    <g data-testid={`turkey-city-outline-${marker.cityId}`} style={{ opacity: marker.dimmed && !selected ? 0.35 : 1 }}>
      {selected && <path {...base} stroke="#1d4ed8" strokeWidth={3.5} data-testid={`turkey-city-selected-${marker.cityId}`} />}
      {isHq && <path {...base} stroke="var(--g-gold, #f5b301)" strokeWidth={3.5} data-testid={`turkey-city-hq-${marker.cityId}`} />}
      {marker.hasIssue && (
        <>
          <path {...base} stroke="var(--g-red, #dc2626)" strokeWidth={isHq ? 1.8 : 3.5} strokeDasharray={isHq ? '6 4' : undefined} data-testid={`turkey-city-issue-${marker.cityId}`} />
          {/* İl merkezinde küçük uyarı rozeti (küçük illerde kenarlık görünmese bile fark edilir) */}
          <g pointerEvents="none" data-testid={`turkey-city-issue-badge-${marker.cityId}`}>
            <circle cx={marker.x} cy={marker.y} r={badge} fill="var(--g-red, #dc2626)" stroke="#ffffff" strokeWidth={1.2 * upp} />
            <rect x={marker.x - 0.8 * upp} y={marker.y - 4 * upp} width={1.6 * upp} height={4.8 * upp} rx={0.6 * upp} fill="#ffffff" />
            <circle cx={marker.x} cy={marker.y + 5.2 * upp} r={1 * upp} fill="#ffffff" />
          </g>
        </>
      )}
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

  const provinceNodes = useMemo(
    () => markers.map((m) => <Province key={m.cityId} marker={m} selected={m.cityId === selectedCityId} />),
    [markers, selectedCityId]
  );
  const outlineNodes = useMemo(
    () => markers.map((m) => <ProvinceOutline key={m.cityId} marker={m} selected={m.cityId === selectedCityId} upp={stableUpp} />),
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
        aria-label="Türkiye haritası. İllere dokunarak bilgi alabilirsin."
      >
        <rect x={-MAP_WIDTH} y={-MAP_HEIGHT} width={MAP_WIDTH * 3} height={MAP_HEIGHT * 3} fill="#0f2a47" />
        <path d={TURKEY_NEIGHBORS_PATH} fill="#1d3a5c" stroke="#2c4d75" strokeWidth={0.8 * Math.max(1, upp * 1.2)} fillRule="evenodd" />
        <g data-testid="turkey-provinces">{provinceNodes}</g>
        <g data-testid="turkey-province-outlines" pointerEvents="none">{outlineNodes}</g>
      </svg>
    </div>
  );
}
