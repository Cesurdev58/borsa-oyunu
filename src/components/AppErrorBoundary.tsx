/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SimulationStore } from '../state/simulationStore';

/**
 * Uygulama geneli hata yakalayıcı.
 * Ekranı çizerken beklenmedik bir hata olursa oyuncu beyaz ekranda kalmaz;
 * sayfayı yenileme, hata ayrıntısını kopyalama ve (iki adımlı, önce yedek alarak)
 * kaydı sıfırlama seçenekleri sunar. Kayıt yedeği alınmadan asla silinmez.
 */

const STACK_SUMMARY_LINES = 6;

/** Hata mesajı + kısa yığın özeti (kopyalanacak metin). Saf fonksiyon, test edilir. */
export function buildErrorReport(
  error: unknown,
  componentStack?: string | null,
  nowISO: string = new Date().toISOString()
): string {
  const err = error instanceof Error ? error : null;
  const name = err?.name || 'Hata';
  const message = err ? err.message : String(error);
  const stackLines = (err?.stack || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith(`${name}:`))
    .slice(0, STACK_SUMMARY_LINES);
  const componentLines = (componentStack || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, STACK_SUMMARY_LINES);
  const parts = [
    `Borsa Patronu hata raporu (${nowISO})`,
    `${name}: ${message}`,
  ];
  if (stackLines.length > 0) parts.push('Yığın:', ...stackLines);
  if (componentLines.length > 0) parts.push('Bileşen:', ...componentLines);
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    parts.push(`Tarayıcı: ${navigator.userAgent}`);
  }
  return parts.join('\n');
}

/** Kayıtlı oyunun ham JSON metni (yoksa null). */
export function readSaveJson(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(SimulationStore.STORAGE_KEY);
  } catch {
    return null;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // aşağıdaki eski yönteme düş
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function downloadText(fileName: string, text: string): boolean {
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

interface AppErrorBoundaryProps {
  children?: React.ReactNode;
}

export interface AppErrorBoundaryState {
  error: unknown;
  hasError: boolean;
  componentStack: string | null;
  /** 'idle' = ana seçenekler; 'confirm' = sıfırlama onayı (ikinci adım) */
  resetStep: 'idle' | 'confirm';
  /** Bu oturumda kayıt yedeği indirildi ya da kopyalandı mı? */
  backupTaken: boolean;
  feedback: string | null;
}

const INITIAL_STATE: AppErrorBoundaryState = {
  error: null,
  hasError: false,
  componentStack: null,
  resetStep: 'idle',
  backupTaken: false,
  feedback: null,
};

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = INITIAL_STATE;

  static getDerivedStateFromError(error: unknown): Partial<AppErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error('[AppErrorBoundary] Yakalanan hata:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyError = async () => {
    const ok = await copyText(buildErrorReport(this.state.error, this.state.componentStack));
    this.setState({
      feedback: ok
        ? 'Hata ayrıntısı panoya kopyalandı.'
        : 'Kopyalanamadı. Ekran görüntüsü alabilirsin.',
    });
  };

  private handleStartReset = () => {
    this.setState({ resetStep: 'confirm', feedback: null });
  };

  private handleCancelReset = () => {
    this.setState({ resetStep: 'idle', feedback: null });
  };

  private handleDownloadBackup = () => {
    const json = readSaveJson();
    if (json === null) {
      this.setState({ backupTaken: true, feedback: 'Kayıtlı oyun bulunamadı; yedeklenecek bir şey yok.' });
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ok = downloadText(`borsa-patronu-yedek-${stamp}.json`, json);
    this.setState({
      backupTaken: ok || this.state.backupTaken,
      feedback: ok ? 'Yedek dosyası indirildi.' : 'İndirilemedi; "Yedeği kopyala" düğmesini dene.',
    });
  };

  private handleCopyBackup = async () => {
    const json = readSaveJson();
    if (json === null) {
      this.setState({ backupTaken: true, feedback: 'Kayıtlı oyun bulunamadı; yedeklenecek bir şey yok.' });
      return;
    }
    const ok = await copyText(json);
    this.setState({
      backupTaken: ok || this.state.backupTaken,
      feedback: ok ? 'Yedek panoya kopyalandı. Bir yere yapıştırıp sakla.' : 'Kopyalanamadı; "Yedeği indir" düğmesini dene.',
    });
  };

  private handleConfirmReset = () => {
    // Güvenlik: yedek alınmadan kayıt silinmez
    if (!this.state.backupTaken) {
      this.setState({ feedback: 'Önce yedeği indir ya da kopyala.' });
      return;
    }
    SimulationStore.clearStorage();
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    const { error, resetStep, backupTaken, feedback } = this.state;
    const message = error instanceof Error ? error.message : String(error);

    return (
      <div
        role="alert"
        data-testid="app-error-boundary"
        className="min-h-screen w-full flex items-center justify-center p-4"
        style={{ background: '#121c44', paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-full max-w-sm rounded-[26px] bg-[var(--g-surface)] p-5 shadow-2xl text-[var(--g-ink)]">
          <h1 className="g-display text-2xl font-extrabold text-[#121c44]">Bir şeyler ters gitti</h1>
          <p className="mt-2 text-[15px] leading-snug text-[var(--g-muted)]">
            Oyun ekranı çizilirken beklenmedik bir hata oldu. Paran ve dükkânların kayıtta duruyor;
            çoğu zaman sayfayı yenilemek yeter.
          </p>
          <p
            data-testid="app-error-message"
            className="mt-3 rounded-xl bg-[var(--g-surface-2)] px-3 py-2 text-[13px] text-[var(--g-muted)] break-words"
          >
            {message || 'Bilinmeyen hata'}
          </p>

          {resetStep === 'idle' ? (
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                data-testid="app-error-reload-btn"
                className="g-btn g-btn-primary min-h-[52px] w-full"
                onClick={this.handleReload}
              >
                Sayfayı Yenile
              </button>
              <button
                type="button"
                data-testid="app-error-copy-btn"
                className="g-btn g-btn-secondary min-h-[48px] w-full"
                onClick={this.handleCopyError}
              >
                Hata Detayını Kopyala
              </button>
              <button
                type="button"
                data-testid="app-error-reset-start-btn"
                className="g-btn g-btn-ghost min-h-[44px] w-full text-[13px]"
                onClick={this.handleStartReset}
              >
                Kaydı Yedekle ve Sıfırla
              </button>
            </div>
          ) : (
            <div data-testid="app-error-reset-confirm" className="mt-4 flex flex-col gap-2">
              <p className="text-[14px] font-bold text-[#c0392b]">
                Sıfırlamak bütün ilerlemeni siler. Önce yedeğini al.
              </p>
              <button
                type="button"
                data-testid="app-error-backup-download-btn"
                className="g-btn g-btn-navy min-h-[48px] w-full"
                onClick={this.handleDownloadBackup}
              >
                1. Yedeği indir (JSON)
              </button>
              <button
                type="button"
                data-testid="app-error-backup-copy-btn"
                className="g-btn g-btn-secondary min-h-[44px] w-full"
                onClick={this.handleCopyBackup}
              >
                Yedeği kopyala
              </button>
              <button
                type="button"
                data-testid="app-error-reset-confirm-btn"
                className="g-btn g-btn-danger min-h-[48px] w-full"
                disabled={!backupTaken}
                onClick={this.handleConfirmReset}
              >
                2. Kaydı sil ve yeniden başla
              </button>
              <button
                type="button"
                data-testid="app-error-reset-cancel-btn"
                className="g-btn g-btn-ghost min-h-[44px] w-full"
                onClick={this.handleCancelReset}
              >
                Vazgeç
              </button>
            </div>
          )}

          {feedback && (
            <p data-testid="app-error-feedback" className="mt-3 text-[13px] text-[var(--g-muted)]">
              {feedback}
            </p>
          )}
        </div>
      </div>
    );
  }
}
