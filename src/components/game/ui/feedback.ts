/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Oyun hissi: kısa sesler ve titreşim.
 * Ses dosyası kullanılmaz; sesler tarayıcının ses motoruyla anında üretilir
 * (internet gerekmez, oyun boyutu büyümez). Ayarlardaki ses düzeyi ve
 * "sessiz" seçeneğine uyar. Sunucu tarafında / testlerde hiçbir şey yapmaz.
 */

export type FeedbackSound = 'tap' | 'coin' | 'success' | 'error' | 'levelup';

let volume = 0.6; // 0..1
let muted = false;
let ctx: AudioContext | null = null;
let lastPlay: Record<string, number> = {};

export function setFeedbackSettings(opts: { masterVolume: number; effectsVolume: number; isMuted: boolean }) {
  volume = Math.max(0, Math.min(1, (opts.masterVolume / 100) * (opts.effectsVolume / 100)));
  muted = opts.isMuted;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  slideTo?: number
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * volume), start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator === 'undefined' || muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* bazı tarayıcılar desteklemez */
  }
}

export function play(sound: FeedbackSound) {
  if (muted || volume <= 0) return;
  const now = Date.now();
  // Aynı ses art arda çok hızlı çalmasın
  if (now - (lastPlay[sound] ?? 0) < (sound === 'tap' ? 40 : 120)) return;
  lastPlay[sound] = now;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  switch (sound) {
    case 'tap':
      tone(ac, 620, t, 0.05, 'triangle', 0.12, 480);
      break;
    case 'coin':
      tone(ac, 988, t, 0.08, 'square', 0.07);
      tone(ac, 1319, t + 0.07, 0.22, 'square', 0.07);
      vibrate(12);
      break;
    case 'success':
      tone(ac, 523, t, 0.12, 'triangle', 0.16);
      tone(ac, 659, t + 0.09, 0.12, 'triangle', 0.16);
      tone(ac, 784, t + 0.18, 0.24, 'triangle', 0.18);
      vibrate([15, 40, 15]);
      break;
    case 'levelup':
      [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, t + i * 0.09, 0.22, 'triangle', 0.18));
      vibrate([20, 50, 20, 50, 40]);
      break;
    case 'error':
      tone(ac, 220, t, 0.16, 'sawtooth', 0.08, 160);
      vibrate([30, 40, 30]);
      break;
  }
}

/** Testler için iç durumu sıfırlar. */
export function __resetFeedbackForTests() {
  lastPlay = {};
}
