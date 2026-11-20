/**
 * Geri tuşu ↔ harita gezinmesi bağlayıcısı (tarayıcı geçmişi). Pencere nesnesi dışarıdan verilir; testler sahte pencere kullanır.
 *
 * Çalışma: akış açılınca geçmişe bir "nöbetçi" kayıt (`{mapFlow:true}`) konur. Geri tuşu onu tüketir (popstate);
 * `onBack` gezinme kuralını uygular ve nöbetçi yeniden konur, böylece sayfadan çıkılmaz. Üstte açık bir pencere kaydı
 * (`gameOverlay`) varsa onu o pencerenin kendi mantığı kapatır; burada dokunulmaz.
 */
export interface HistoryLike {
  state: unknown;
  pushState(state: unknown, title: string): void;
  back(): void;
}
export interface WindowLike {
  history: HistoryLike;
  addEventListener(type: 'popstate', fn: () => void): void;
  removeEventListener(type: 'popstate', fn: () => void): void;
}

export const MAP_FLOW_SENTINEL = { mapFlow: true };

export function attachMapBackHandler(
  win: WindowLike,
  onBack: () => 'handled' | 'exit-confirm',
  isExitAllowed: () => boolean = () => false
): () => void {
  let silent = false;
  win.history.pushState(MAP_FLOW_SENTINEL, '');
  const onPop = () => {
    if (silent) { silent = false; return; }
    const st = win.history.state as { mapFlow?: boolean; gameOverlay?: boolean } | null;
    if (st?.mapFlow || st?.gameOverlay) return;
    if (isExitAllowed()) return;
    onBack();
    win.history.pushState(MAP_FLOW_SENTINEL, '');
  };
  win.addEventListener('popstate', onPop);
  return () => {
    win.removeEventListener('popstate', onPop);
    if ((win.history.state as { mapFlow?: boolean } | null)?.mapFlow) {
      silent = true;
      win.history.back();
    }
  };
}
