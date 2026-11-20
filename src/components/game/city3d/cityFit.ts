/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Çizilmiş bir bina modelini parselinin içinde ve yollardan uzakta tutar (WebGL gerektirmez; testler de çağırır).
 * Geometri çözücüsü `city/cityClearance.ts` içindedir; burası yalnızca modelin ayak izini çıkarır ve sonucu
 * modele uygular.
 */
import * as THREE from 'three';
import { fitFootprint, convexHull, type FitOptions, type FitResult, type Pt } from '../city/cityClearance';
import type { WorldRect } from '../city/CityGridDefinition';

/**
 * Modelin yer düzlemindeki ayak izi: her parçanın sınır kutusu kökün yerel uzayına dönüştürülür, dört köşesi
 * dünya (x,z) konumuna çevrilir ve dışbükey zarf alınır. Parsel merkezi = kökün dünya konumu.
 */
export function modelFootprintHull(model: THREE.Object3D, parcel: WorldRect): Pt[] {
  model.updateMatrixWorld(true);
  const root = model.parent ?? model;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const pts: Pt[] = [];
  const m4 = new THREE.Matrix4();
  const v = new THREE.Vector3();
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || !mesh.visible) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb || bb.isEmpty()) return;
    m4.multiplyMatrices(inv, mesh.matrixWorld);
    for (const x of [bb.min.x, bb.max.x]) {
      for (const y of [bb.min.y, bb.max.y]) {
        for (const z of [bb.min.z, bb.max.z]) {
          v.set(x, y, z).applyMatrix4(m4);
          if (Number.isFinite(v.x) && Number.isFinite(v.z)) pts.push({ x: parcel.cx + v.x, z: parcel.cz + v.z });
        }
      }
    }
  });
  return convexHull(pts);
}

export interface PlaceResult extends FitResult {
  /** Çözüm bulunamadıysa insan okur açıklama */
  problem?: string;
}

/**
 * Modeli parselin içinde kaydırır / küçültür (gerekirse) ve uygular. Model `root` (parsel merkezinde duran grup)
 * altında olmalıdır. Çözüm yoksa en az kötü durum uygulanır, `ok=false` ve `problem` döner.
 */
export function placeModelInParcel(model: THREE.Object3D, parcel: WorldRect, options?: FitOptions): PlaceResult {
  const hull = modelFootprintHull(model, parcel);
  if (hull.length < 3) {
    return { dx: 0, dz: 0, scale: 1, margin: 0, ok: false, withinParcel: false, minGap: NaN, bestEffort: true, problem: 'ayak izi hesaplanamadı (model boş ya da sınır kutusu geçersiz)' };
  }
  const fit = fitFootprint(hull, parcel, options);
  if (fit.dx !== 0 || fit.dz !== 0 || fit.scale !== 1) {
    model.position.multiplyScalar(fit.scale);
    model.position.x += fit.dx;
    model.position.z += fit.dz;
    model.scale.multiplyScalar(fit.scale);
  }
  return fit.ok ? fit : { ...fit, problem: `yol boşluğu sağlanamadı (en yakın boşluk ${fit.minGap.toFixed(2)}, parsel içinde=${fit.withinParcel})` };
}
