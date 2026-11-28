/**
 * Android/iOS (Capacitor) durum çubuğu ayarı. Web tarayıcıda ve GitHub Pages'te hiçbir şey yapmaz.
 */
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export const NATIVE_STATUS_BAR_COLOR = '#1e293b';
/** Temaya göre üst durum çubuğu rengi (Sıcak Tycoon koyu üst çubuk, Gece Patronu derin lacivert). */
export const NATIVE_STATUS_BAR_COLORS = { warm: '#1e293b', night: '#0b1226' } as const;

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

/** Tema değişince durum çubuğu rengini günceller (yalnızca telefonda). */
export async function setNativeStatusBarTheme(theme: keyof typeof NATIVE_STATUS_BAR_COLORS): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setBackgroundColor({ color: NATIVE_STATUS_BAR_COLORS[theme] });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // Eklenti yoksa sessizce vazgeç.
  }
}
