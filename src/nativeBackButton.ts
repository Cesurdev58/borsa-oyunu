/**
 * Android donanım geri tuşu (Capacitor `@capacitor/app`). Web tarayıcıda ve GitHub Pages'te hiçbir şey yapmaz.
 *
 * Çalışma: ekranlar `registerBackHandler(öncelik, fn)` ile kendi geri kurallarını kaydeder. Geri tuşuna basılınca
 * küçük öncelik sayısından başlayarak sırayla denenir; `true` döndüren ilk kural işi üstlenir:
 *   0 = açık pencere/çekmece  ·  1 = harita gezinmesi  ·  2 = alt sekme → Harita  ·  3 = çıkış (2 sn içinde ikinci basış)
 */
import { Capacitor } from '@capacitor/core';

export const BACK_PRIORITY = { overlay: 0, map: 1, tab: 2, exit: 3 } as const;
export const EXIT_CONFIRM_MS = 2000;

type BackHandler = () => boolean;
const handlers: Array<{ priority: number; fn: BackHandler }> = [];

export function registerBackHandler(priority: number, fn: BackHandler): () => void {
  const entry = { priority, fn };
  handlers.push(entry);
  return () => {
    const i = handlers.indexOf(entry);
    if (i >= 0) handlers.splice(i, 1);
  };
}

/** Kayıtlı kuralları sırayla dener; biri işi üstlendiyse true döner. */
export function dispatchBack(): boolean {
  const ordered = [...handlers].sort((a, b) => a.priority - b.priority);
  for (const h of ordered) {
    try {
      if (h.fn()) return true;
    } catch {
      // Bir kuralın hatası öbürlerini engellemesin.
    }
  }
  return false;
}

/** "Çıkmak için tekrar bas": ilk basış uyarır, `windowMs` içindeki ikinci basış çıkar. */
export function createExitGuard(now: () => number = Date.now, windowMs: number = EXIT_CONFIRM_MS) {
  let last = -Infinity;
  return {
    press(): 'warn' | 'exit' {
      const t = now();
      if (t - last <= windowMs) {
        last = -Infinity;
        return 'exit';
      }
      last = t;
      return 'warn';
    },
  };
}

export async function exitNativeApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { App } = await import('@capacitor/app');
    await App.exitApp();
  } catch {
    // Eklenti yoksa sessizce vazgeç.
  }
}

/** Yalnızca yerel platformda geri tuşunu dinler. Dönen işlev dinlemeyi bırakır. */
export async function setupNativeBackButton(): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  try {
    const { App } = await import('@capacitor/app');
    const sub = await App.addListener('backButton', () => {
      dispatchBack();
    });
    return () => {
      void sub.remove();
    };
  } catch {
    return () => undefined;
  }
}
