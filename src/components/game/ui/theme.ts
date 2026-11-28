/**
 * Görünüm teması: `document.documentElement.dataset.theme` = 'warm' | 'night'.
 * Renkler `src/index.css` içinde iki `:root[data-theme]` bloğundadır. Seçim `UISettingsStore.theme` ile kalıcıdır.
 */
import type { UIThemeSetting } from '../../../state/uiSettingsStore';
import { setNativeStatusBarTheme } from '../../../nativeStatusBar';

export function applyTheme(theme: UIThemeSetting | undefined): UIThemeSetting {
  const t: UIThemeSetting = theme === 'night' ? 'night' : 'warm';
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'night' ? '#0b1226' : '#1e293b');
  }
  void setNativeStatusBarTheme(t);
  return t;
}
