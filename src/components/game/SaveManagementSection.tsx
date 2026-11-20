/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Ayarlar → "Kayıt ve yedek": kaydı dosyaya aktar, dosyadan yükle, otomatik yedeklerden geri dön.
 * Sadece arayüz; motor değişimi App'te yapılır (`onExport`, `onImport`, `onRestoreBackup`).
 */
import React, { useRef, useState } from 'react';
import { Download, History, Upload } from 'lucide-react';
import { BACKUP_REASON_LABEL, type BackupSlotInfo } from '../../state/SaveBackups';

export interface SaveManagementProps {
  onExport: () => Promise<{ ok: boolean; message: string }>;
  onImport: (text: string) => Promise<{ ok: boolean; message: string }>;
  listBackups: () => BackupSlotInfo[];
  onRestoreBackup: (slot: number) => { ok: boolean; message: string };
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export const SaveManagementSection: React.FC<SaveManagementProps> = ({ onExport, onImport, listBackups, onRestoreBackup }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState<BackupSlotInfo[]>(() => listBackups());
  const [confirmSlot, setConfirmSlot] = useState<number | null>(null);

  const show = (r: { ok: boolean; message: string }) => setMessage({ ok: r.ok, text: r.message });

  return (
    <details
      className="group rounded-2xl bg-[var(--g-surface-2)] px-3 py-2"
      data-testid="save-management"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) setBackups(listBackups());
      }}
    >
      <summary className="cursor-pointer list-none min-h-[40px] flex items-center justify-between text-[13px] font-extrabold text-[var(--g-muted)]">
        Kayıt dosyası ve yedekler
        <span className="transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-2 pb-1">
        <button
          type="button"
          data-testid="save-export-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            show(await onExport());
            setBusy(false);
          }}
          className="g-btn g-btn-secondary w-full"
        >
          <Download className="w-4 h-4" />
          <span>Kaydı dosyaya aktar</span>
        </button>
        <button
          type="button"
          data-testid="save-import-btn"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="g-btn g-btn-secondary w-full"
        >
          <Upload className="w-4 h-4" />
          <span>Dosyadan yükle</span>
        </button>
        <input
          ref={fileRef}
          data-testid="save-import-input"
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            try {
              show(await onImport(await file.text()));
            } catch {
              setMessage({ ok: false, text: 'Dosya okunamadı. Tekrar dene.' });
            }
            setBusy(false);
            setBackups(listBackups());
          }}
        />
        <div className="g-tip">Dosya yükleyince şimdiki oyunun önce yedeğe alınır; yanlış dosyada oyunun değişmez.</div>

        <div className="flex items-center gap-2 pt-1 text-[13px] font-extrabold text-[var(--g-muted)]">
          <History className="w-4 h-4" /> Otomatik yedekler (son {backups.length}/5)
        </div>
        {backups.length === 0 ? (
          <div className="text-[13px] text-[var(--g-muted)]" data-testid="save-backups-empty">
            Henüz yedek yok. Oyun kendiliğinden birkaç dakikada bir ve büyük kararlardan önce yedek alır.
          </div>
        ) : (
          <ul className="space-y-1.5" data-testid="save-backups-list">
            {backups.map((b) => (
              <li key={b.slot} className="rounded-xl bg-white px-3 py-2 flex items-center justify-between gap-2" data-testid={`save-backup-${b.slot}`}>
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold text-[var(--g-ink)] truncate">{BACKUP_REASON_LABEL[b.reason] ?? 'Yedek'}</div>
                  <div className="text-[13px] text-[var(--g-muted)]">
                    {when(b.savedAtISO)} · Gün {b.day}
                  </div>
                </div>
                {confirmSlot === b.slot ? (
                  <button
                    type="button"
                    data-testid={`save-backup-confirm-${b.slot}`}
                    onClick={() => {
                      show(onRestoreBackup(b.slot));
                      setConfirmSlot(null);
                      setBackups(listBackups());
                    }}
                    className="g-btn g-btn-danger g-btn-sm shrink-0"
                  >
                    Emin misin?
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid={`save-backup-restore-${b.slot}`}
                    onClick={() => setConfirmSlot(b.slot)}
                    className="g-btn g-btn-ghost g-btn-sm shrink-0"
                  >
                    Geri dön
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {message && (
          <div
            role="status"
            data-testid="save-management-message"
            className={`rounded-xl px-3 py-2 text-[13px] font-bold ${message.ok ? 'bg-[#ecfaf3] text-[var(--g-green-dark)]' : 'bg-red-50 text-[var(--g-red)]'}`}
          >
            {message.text}
          </div>
        )}
      </div>
    </details>
  );
};
