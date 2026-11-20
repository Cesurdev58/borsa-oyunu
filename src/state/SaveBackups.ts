/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OTOMATİK YEREL YEDEK (5 yuvalı, dönen)
 *  - Her `AUTO_BACKUP_INTERVAL_MS` (7 dk) içinde en çok bir kez ve kritik işlemlerden (şirketleşme, halka arz,
 *    prestij, devralma, dosyadan içe aktarma) HEMEN ÖNCE yedek alınır.
 *  - 5 yuva sırayla üzerine yazılır (en eski yuva yenilenir). Yuvalar localStorage'dadır, ana kayıttan ayrıdır.
 *  - Depolama dolarsa en eski yuvalar tek tek silinip yeniden denenir; yedek hatası oyunu ASLA durdurmaz.
 * Yalnızca localStorage ve SimulationStore'a bağlıdır; motor bunu bilmez (motor yalnızca "kritik işlem" kancasını çağırır).
 */
import type { SimulationEngine } from '../engine/SimulationEngine';
import { SimulationStore } from './simulationStore';

export const BACKUP_SLOT_COUNT = 5;
export const AUTO_BACKUP_INTERVAL_MS = 7 * 60 * 1000;
export const BACKUP_SLOT_KEY_PREFIX = 'borsa_holding_simulator_backup_slot_';
export const BACKUP_META_KEY = 'borsa_holding_simulator_backup_meta';

export type BackupReason =
  | 'auto'
  | 'before-company'
  | 'before-incorporation'
  | 'before-ipo'
  | 'before-prestige'
  | 'before-takeover'
  | 'before-import';

export const BACKUP_REASON_LABEL: Record<BackupReason, string> = {
  auto: 'Otomatik yedek',
  'before-company': 'Şirket kurmadan önce',
  'before-incorporation': 'Şirketleşmeden önce',
  'before-ipo': 'Halka arzdan önce',
  'before-prestige': 'Yeni şehre geçmeden önce',
  'before-takeover': 'Devralmadan önce',
  'before-import': 'Dosyadan yüklemeden önce',
};

export interface BackupSlotInfo {
  slot: number;
  savedAtISO: string;
  reason: BackupReason;
  day: number;
  netWorth: number;
  /** Yazma sırası (büyük = daha yeni) */
  seq: number;
}

interface BackupMeta {
  seq: number;
  slots: BackupSlotInfo[];
  lastAutoMs: number;
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readMeta(ls: Storage): BackupMeta {
  try {
    const raw = ls.getItem(BACKUP_META_KEY);
    if (raw) {
      const m = JSON.parse(raw) as Partial<BackupMeta>;
      if (m && Array.isArray(m.slots)) {
        return {
          seq: typeof m.seq === 'number' ? m.seq : 0,
          lastAutoMs: typeof m.lastAutoMs === 'number' ? m.lastAutoMs : 0,
          slots: m.slots.filter(
            (s) => s && Number.isInteger(s.slot) && s.slot >= 0 && s.slot < BACKUP_SLOT_COUNT && typeof s.savedAtISO === 'string'
          ),
        };
      }
    }
  } catch {
    // bozuk bilgi: sıfırdan başla
  }
  return { seq: 0, slots: [], lastAutoMs: 0 };
}

function writeMeta(ls: Storage, meta: BackupMeta): void {
  ls.setItem(BACKUP_META_KEY, JSON.stringify(meta));
}

/** Sıradaki yuva: boş olan ilk yuva, hepsi doluysa en eski */
function nextSlot(meta: BackupMeta): number {
  for (let i = 0; i < BACKUP_SLOT_COUNT; i++) {
    if (!meta.slots.some((s) => s.slot === i)) return i;
  }
  return [...meta.slots].sort((a, b) => a.seq - b.seq)[0].slot;
}

export class SaveBackups {
  /** Yedek listesi, en yeni başta */
  public static list(): BackupSlotInfo[] {
    const ls = storage();
    if (!ls) return [];
    const meta = readMeta(ls);
    return meta.slots
      .filter((s) => ls.getItem(BACKUP_SLOT_KEY_PREFIX + s.slot) !== null)
      .sort((a, b) => b.seq - a.seq);
  }

  /** Zamanlayıcı için: son otomatik yedekten bu yana yeterli süre geçti mi? */
  public static isAutoBackupDue(nowMs: number): boolean {
    const ls = storage();
    if (!ls) return false;
    return nowMs - readMeta(ls).lastAutoMs >= AUTO_BACKUP_INTERVAL_MS;
  }

  /**
   * Motorun şu anki durumunu bir yuvaya yazar. Başarılıysa yuva bilgisini, olmadıysa null döner (asla fırlatmaz).
   * `auto` yedeği süre dolmadıysa atlanır (null); kritik yedekler her zaman alınır.
   */
  public static take(engine: SimulationEngine, reason: BackupReason, nowMs: number = Date.now()): BackupSlotInfo | null {
    const ls = storage();
    if (!ls) return null;
    try {
      const meta = readMeta(ls);
      if (reason === 'auto' && nowMs - meta.lastAutoMs < AUTO_BACKUP_INTERVAL_MS) return null;
      // Aynı kritik işlem art arda denenirse (ör. hatalı form) yuvalar dolmasın: 60 sn içinde aynı sebep atlanır
      if (reason !== 'auto') {
        const newest = [...meta.slots].sort((a, b) => b.seq - a.seq)[0];
        if (newest && newest.reason === reason && nowMs - Date.parse(newest.savedAtISO) < 60_000) return newest;
      }

      const st = engine.getState();
      const nowISO = new Date(nowMs).toISOString();
      // Ana kayıtla aynı biçim: zarf; kayıt anındaki rastgele durum da girer
      const envelope = {
        schemaVersion: SimulationStore.CURRENT_SCHEMA_VERSION,
        savedAtISO: nowISO,
        seed: st.seed,
        randomState: engine.getRandomState(),
        state: JSON.parse(JSON.stringify(st)),
      };
      const json = JSON.stringify(envelope);

      let slot = nextSlot(meta);
      const writeOnce = () => ls.setItem(BACKUP_SLOT_KEY_PREFIX + slot, json);
      try {
        writeOnce();
      } catch {
        // Depolama dolu: en eski yuvaları tek tek boşaltıp yeniden dene (kendi yuvamız dahil)
        let ok = false;
        const byAge = [...meta.slots].sort((a, b) => a.seq - b.seq);
        for (const old of byAge) {
          ls.removeItem(BACKUP_SLOT_KEY_PREFIX + old.slot);
          meta.slots = meta.slots.filter((s) => s.slot !== old.slot);
          slot = old.slot;
          try {
            writeOnce();
            ok = true;
            break;
          } catch {
            // bir sonraki eski yuvayı boşalt
          }
        }
        if (!ok) return null;
      }

      meta.seq += 1;
      const info: BackupSlotInfo = {
        slot,
        savedAtISO: nowISO,
        reason,
        day: st.day,
        netWorth: Math.round(st.netWorth),
        seq: meta.seq,
      };
      meta.slots = meta.slots.filter((s) => s.slot !== slot).concat(info);
      if (reason === 'auto') meta.lastAutoMs = nowMs;
      writeMeta(ls, meta);
      return info;
    } catch {
      return null;
    }
  }

  /** Yuvadaki yedeği motor olarak yükler. Yedek yoksa ya da bozuksa null (ve neden). */
  public static load(slot: number): { engine: SimulationEngine | null; error?: string } {
    const ls = storage();
    if (!ls) return { engine: null, error: 'Tarayıcı depolamasına erişilemiyor.' };
    const raw = ls.getItem(BACKUP_SLOT_KEY_PREFIX + slot);
    if (!raw) return { engine: null, error: 'Bu yuvada yedek yok.' };
    try {
      const engine = SimulationStore.engineFromEnvelope(JSON.parse(raw));
      return engine ? { engine } : { engine: null, error: 'Yedek okunamadı (bozulmuş olabilir).' };
    } catch {
      return { engine: null, error: 'Yedek okunamadı (bozulmuş olabilir).' };
    }
  }

  /** Motorun kritik işlem kancasını yedeğe bağlar (uygulama, motor ortak motor olunca çağırır). */
  public static attach(engine: SimulationEngine): void {
    engine.criticalActionHook = (reason) => {
      SaveBackups.take(engine, reason);
    };
  }

  /** Testler ve "tümünü sil" için */
  public static clearAll(): void {
    const ls = storage();
    if (!ls) return;
    for (let i = 0; i < BACKUP_SLOT_COUNT; i++) ls.removeItem(BACKUP_SLOT_KEY_PREFIX + i);
    ls.removeItem(BACKUP_META_KEY);
  }
}
