/**
 * Android/iOS (Capacitor) durum çubuğu ayarı. Web tarayıcıda ve GitHub Pages'te hiçbir şey yapmaz.
 */
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export const NATIVE_STATUS_BAR_COLOR = '#121c44';

export async function setupNativeStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: NATIVE_STATUS_BAR_COLOR });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // Eklenti yoksa ya da platform desteklemiyorsa oyun yine de açılmalı.
  }
}
