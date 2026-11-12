/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Tarayıcı 3D (WebGL) çizebiliyor mu? Sunucuda ve testlerde her zaman false. */
export function webglAvailable(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
