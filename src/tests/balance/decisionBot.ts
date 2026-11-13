/**
 * Karar kartlarına "makul oyuncu" gibi cevap veren ölçüm yardımcısı.
 * Kartlar artık cevapsız kalınca ikinci seçenek kendiliğinden uygulandığı için, denge ölçümü
 * dikkatli bir oyuncuyu taklit eder: zararı önleyen ve bedava faydalı seçenekleri seçer.
 */
import type { SimulationEngine } from '../../engine/SimulationEngine';

const PICK: Record<string, 'A' | 'B'> = {
  festival: 'B',
  'bad-review': 'A',
  'staff-raise': 'A',
  inspection: 'A',
  'pipe-burst': 'A',
  newspaper: 'A',
  'bulk-order': 'A',
  'cousin-partner': 'B',
  'old-debt': 'A',
};

export function answerDecisionSensibly(eng: SimulationEngine): void {
  const pending = eng.getState().decisionEvents?.pending;
  if (!pending) return;
  const pick = PICK[pending.templateId] ?? 'B';
  const res = eng.resolveDecisionEvent(pick);
  if (!res.success && pick === 'A') eng.resolveDecisionEvent('B');
}
