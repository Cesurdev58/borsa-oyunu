/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * KAYDI DOSYAYA AKTAR / DOSYADAN YÜKLE (SHA-256 kontrol kodlu JSON).
 * Biçim ve doğrulama `engine/SimulationPersistence.ts` içindedir; burası motoru ve depoyu bağlar.
 * İçe aktarma motoru KURAR ama mevcut kaydı değiştirmez: çağıran (uygulama) önce yedek alıp `replaceSharedEngine` der.
 */
import type { SimulationEngine } from '../engine/SimulationEngine';
import {
  SaveFileError,
  buildSaveFileText,
  parseSaveFileText,
  saveFileName,
} from '../engine/SimulationPersistence';
import { SimulationStore } from './simulationStore';

export { SaveFileError };

export async function exportSaveFile(
  engine: SimulationEngine,
  nowISO: string = new Date().toISOString()
): Promise<{ fileName: string; text: string }> {
  const envelope = SimulationStore.buildEnvelope(engine, nowISO);
  const text = await buildSaveFileText(envelope, nowISO);
  return { fileName: saveFileName(envelope.state.day, nowISO), text };
}

/** Dosya metnini doğrular, göçten geçirir ve yeni motor döner. Sorunda Türkçe mesajlı `SaveFileError` fırlatır. */
export async function importSaveFile(text: string): Promise<SimulationEngine> {
  const { envelope } = await parseSaveFileText(text);
  const engine = SimulationStore.engineFromEnvelope(envelope);
  if (!engine) {
    throw new SaveFileError(
      'PAYLOAD_UNREADABLE',
      'Kayıt dosyası sağlam ama içindeki oyun verisi bu sürümle okunamadı. Mevcut oyunun değişmedi.'
    );
  }
  return engine;
}
