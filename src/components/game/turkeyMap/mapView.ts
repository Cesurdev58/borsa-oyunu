/**
 * Harita kamerası — saf hesaplar (arayüzden bağımsız, testlenebilir).
 *
 * Kamera = { panX, panY, zoom }: panX/panY görünen alanın MERKEZİ (harita birimi, 1000 genişlikli sahne),
 * zoom 1 = bütün Türkiye ekrana sığar. Görünen alan haritanın (küçük bir pay dahil) dışına taşamaz.
 */
import type { CityId, TurkeyMapViewState } from '../../../models/cities';
import { MAP_HEIGHT } from '../../../data/cityDefinitions';
import { MAP_WIDTH } from '../../../data/cityBalance';

export const MAP_PAD = 30;
export const MAP_MIN_ZOOM = 1;
/** Bu yakınlıkta ekranda yaklaşık 3–6 şehir görünür (şehirler arası ortalama ~70–100 birim). */
export const MAP_MAX_ZOOM = 8;

export const DEFAULT_MAP_VIEW: TurkeyMapViewState = {
  panX: MAP_WIDTH / 2,
  panY: MAP_HEIGHT / 2,
  zoom: MAP_MIN_ZOOM,
};

const SCENE_W = MAP_WIDTH + 2 * MAP_PAD;
const SCENE_H = MAP_HEIGHT + 2 * MAP_PAD;

/** aspect = kapsayıcının yüksekliği / genişliği. */
export function baseViewWidth(aspect: number): number {
  return Math.max(SCENE_W, SCENE_H / Math.max(0.1, aspect));
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function viewBoxFor(view: TurkeyMapViewState, aspect: number): ViewBox {
  const w = baseViewWidth(aspect) / view.zoom;
  const h = w * aspect;
  return { x: view.panX - w / 2, y: view.panY - h / 2, w, h };
}

/** Kamerayı geçerli sınırlara çeker; bozuk (NaN, sonsuz, eksik) kayıt varsayılana döner. */
export function clampMapView(view: Partial<TurkeyMapViewState> | undefined, aspect: number): TurkeyMapViewState {
  const ok = view && [view.panX, view.panY, view.zoom].every((n) => typeof n === 'number' && Number.isFinite(n));
  const v = ok ? (view as TurkeyMapViewState) : DEFAULT_MAP_VIEW;
  const zoom = Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, v.zoom));
  const w = baseViewWidth(aspect) / zoom;
  const h = w * aspect;
  const axis = (c: number, size: number, sceneSize: number, mapSize: number) =>
    size >= sceneSize ? mapSize / 2 : Math.min(mapSize + MAP_PAD - size / 2, Math.max(-MAP_PAD + size / 2, c));
  return {
    zoom,
    panX: axis(v.panX, w, SCENE_W, MAP_WIDTH),
    panY: axis(v.panY, h, SCENE_H, MAP_HEIGHT),
  };
}

/** Ekranda (px) sürükleme: harita parmakla birlikte kayar. */
export function panByPixels(
  view: TurkeyMapViewState,
  dxPx: number,
  dyPx: number,
  widthPx: number,
  aspect: number
): TurkeyMapViewState {
  const unitsPerPx = baseViewWidth(aspect) / view.zoom / Math.max(1, widthPx);
  return clampMapView({ ...view, panX: view.panX - dxPx * unitsPerPx, panY: view.panY - dyPx * unitsPerPx }, aspect);
}

/** Verilen ekran noktasının (fx, fy ∈ 0..1) altındaki harita noktası sabit kalacak şekilde yakınlaştırır. */
export function zoomAtPoint(
  view: TurkeyMapViewState,
  aspect: number,
  fx: number,
  fy: number,
  newZoom: number
): TurkeyMapViewState {
  const before = viewBoxFor(view, aspect);
  const px = before.x + fx * before.w;
  const py = before.y + fy * before.h;
  const zoom = Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, newZoom));
  const w = baseViewWidth(aspect) / zoom;
  const h = w * aspect;
  return clampMapView({ zoom, panX: px - (fx - 0.5) * w, panY: py - (fy - 0.5) * h }, aspect);
}

/** Verilen noktaların hepsi görünecek şekilde kamerayı ayarlar (tek nokta: şehir civarına yakınlaşır). */
export function fitViewToPoints(
  points: Array<{ x: number; y: number }>,
  aspect: number,
  marginUnits = 60
): TurkeyMapViewState {
  if (points.length === 0) return DEFAULT_MAP_VIEW;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const spanX = Math.max(...xs) - Math.min(...xs) + 2 * marginUnits;
  const spanY = Math.max(...ys) - Math.min(...ys) + 2 * marginUnits;
  const needW = Math.max(spanX, spanY / Math.max(0.1, aspect));
  const zoom = baseViewWidth(aspect) / needW;
  return clampMapView(
    { zoom, panX: (Math.max(...xs) + Math.min(...xs)) / 2, panY: (Math.max(...ys) + Math.min(...ys)) / 2 },
    aspect
  );
}

/** Ekrandaki 1 px kaç harita birimidir (işaret boyutunu sabit tutmak için). */
export function unitsPerPixel(view: TurkeyMapViewState, widthPx: number, aspect: number): number {
  return baseViewWidth(aspect) / view.zoom / Math.max(1, widthPx);
}

export interface MapMarkerModel {
  cityId: CityId;
  nameTR: string;
  x: number;
  y: number;
  markerState: 'EMPTY' | 'OWNED' | 'HEADQUARTERS';
  hasIssue: boolean;
  shopCount: number;
  /** Etkin filtreye uymuyor: soluk çizilir ama yine dokunulabilir (filtre kamerayı/seçimi bozmaz). */
  dimmed?: boolean;
}

/** Ekran okuyucu etiketi: şehir adı yalnızca burada ve alt panelde geçer. */
export function markerAriaLabel(m: Pick<MapMarkerModel, 'nameTR' | 'markerState' | 'hasIssue' | 'shopCount'>): string {
  const base =
    m.markerState === 'HEADQUARTERS'
      ? `${m.nameTR}, şirket merkezi, ${m.shopCount} mağaza`
      : m.markerState === 'OWNED'
      ? `${m.nameTR}, ${m.shopCount} mağaza`
      : `${m.nameTR}, henüz mağaza yok`;
  return m.hasIssue ? `${base}, sorun var` : base;
}
