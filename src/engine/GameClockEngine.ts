/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GERÇEK ZAMANLI OYUN SAATİ VE PİYASA SEANS MOTORU (GameClockEngine)
 * - 1 oyun günü = 1440 oyun dakikası (00:00 – 23:59)
 * - Varsayılan gerçek süre karşılığı: 45 gerçek dakika (ayarlanabilir: 30 / 45 / 60 dk)
 * - Hız çarpanları: Duraklat (0x), 1x, 2x
 * - Piyasa Seansları:
 *   00:00–08:59 -> MARKET_CLOSED
 *   09:00–09:59 -> PRE_OPEN
 *   10:00–17:59 -> MARKET_OPEN
 *   18:00–23:59 -> AFTER_HOURS
 * - Maksimum çevrimdışı ilerleme sınırı: 3 oyun günü (4320 oyun dakikası)
 */

import {
  MarketSession,
  RealMinutesPerGameDayOption,
  TimeScaleOption,
} from '../models/simulation';

export interface SessionScheduleBoundary {
  session: MarketSession;
  startMinuteOfDay: number; // inclusive
  endMinuteOfDay: number; // inclusive
  labelTR: string;
}

export class GameClockEngine {
  public static readonly MINUTES_PER_GAME_DAY = 1440;
  public static readonly DEFAULT_REAL_MINUTES_PER_GAME_DAY: RealMinutesPerGameDayOption = 15;
  public static readonly INTRADAY_SUBSTEP_MINUTES = 5;
  public static readonly SUBSTEPS_PER_DAY =
    GameClockEngine.MINUTES_PER_GAME_DAY /
    GameClockEngine.INTRADAY_SUBSTEP_MINUTES; // 288
  public static readonly MARKET_OPEN_START_MINUTE = 10 * 60; // 600 (10:00)
  public static readonly MARKET_OPEN_END_MINUTE = 18 * 60; // 1080 (18:00)
  public static readonly MARKET_OPEN_SUBSTEPS_PER_DAY =
    (GameClockEngine.MARKET_OPEN_END_MINUTE -
      GameClockEngine.MARKET_OPEN_START_MINUTE) /
    GameClockEngine.INTRADAY_SUBSTEP_MINUTES; // 96
  public static readonly MAX_OFFLINE_GAME_DAYS = 8; // 15 dk/gün ile yaklaşık 2 gerçek saat çevrimdışı ilerleme
  public static readonly MAX_OFFLINE_GAME_MINUTES =
    GameClockEngine.MAX_OFFLINE_GAME_DAYS *
    GameClockEngine.MINUTES_PER_GAME_DAY; // 11520
  public static readonly MAX_REAL_SECONDS_SANITY_LIMIT = 365 * 24 * 3600; // 1 gerçek yıl üstü geçersiz kabul edilir

  public static readonly ALLOWED_REAL_MINUTES_OPTIONS: readonly RealMinutesPerGameDayOption[] =
    [15, 30, 45, 60];
  public static readonly ALLOWED_TIME_SCALES: readonly TimeScaleOption[] = [
    0, 1, 2,
  ];

  private static readonly SESSION_TABLE: readonly SessionScheduleBoundary[] = [
    {
      session: 'MARKET_CLOSED',
      startMinuteOfDay: 0,
      endMinuteOfDay: 9 * 60 - 1, // 00:00 - 08:59 (0..539)
      labelTR: 'PİYASA KAPALI (00:00–08:59)',
    },
    {
      session: 'PRE_OPEN',
      startMinuteOfDay: 9 * 60,
      endMinuteOfDay: 10 * 60 - 1, // 09:00 - 09:59 (540..599)
      labelTR: 'AÇILIŞ ÖNCESİ SEANS (09:00–09:59)',
    },
    {
      session: 'MARKET_OPEN',
      startMinuteOfDay: 10 * 60,
      endMinuteOfDay: 18 * 60 - 1, // 10:00 - 17:59 (600..1079)
      labelTR: 'PİYASA AÇIK (10:00–17:59)',
    },
    {
      session: 'AFTER_HOURS',
      startMinuteOfDay: 18 * 60,
      endMinuteOfDay: 24 * 60 - 1, // 18:00 - 23:59 (1080..1439)
      labelTR: 'KAPANIŞ SONRASI (18:00–23:59)',
    },
  ];

  /**
   * Merkezi piyasa seansı belirleme fonksiyonu.
   * 00:00–08:59 -> MARKET_CLOSED
   * 09:00–09:59 -> PRE_OPEN
   * 10:00–17:59 -> MARKET_OPEN
   * 18:00–23:59 -> AFTER_HOURS
   */
  public static getMarketSession(minutesIntoDay: number): MarketSession {
    const normalized = GameClockEngine.normalizeMinuteOfDay(minutesIntoDay);
    for (const entry of GameClockEngine.SESSION_TABLE) {
      if (
        normalized >= entry.startMinuteOfDay &&
        normalized <= entry.endMinuteOfDay
      ) {
        return entry.session;
      }
    }
    return 'MARKET_CLOSED';
  }

  public static getMarketSessionLabelTR(session: MarketSession): string {
    const found = GameClockEngine.SESSION_TABLE.find(
      (s) => s.session === session
    );
    return found ? found.labelTR : 'PİYASA KAPALI';
  }

  public static isMarketOpen(session: MarketSession): boolean {
    return session === 'MARKET_OPEN';
  }

  public static normalizeMinuteOfDay(minutesIntoDay: number): number {
    if (!Number.isFinite(minutesIntoDay)) return 0;
    const floored = Math.floor(minutesIntoDay);
    const mod =
      ((floored % GameClockEngine.MINUTES_PER_GAME_DAY) +
        GameClockEngine.MINUTES_PER_GAME_DAY) %
      GameClockEngine.MINUTES_PER_GAME_DAY;
    return mod;
  }

  public static computeClockFields(minutesIntoCurrentDay: number): {
    minutesIntoCurrentDay: number;
    currentGameHour: number;
    currentGameMinute: number;
    marketSession: MarketSession;
    formattedTime: string;
  } {
    const normalized = GameClockEngine.normalizeMinuteOfDay(
      minutesIntoCurrentDay
    );
    const currentGameHour = Math.floor(normalized / 60);
    const currentGameMinute = normalized % 60;
    const marketSession = GameClockEngine.getMarketSession(normalized);
    return {
      minutesIntoCurrentDay: normalized,
      currentGameHour,
      currentGameMinute,
      marketSession,
      formattedTime: GameClockEngine.formatGameTime(
        currentGameHour,
        currentGameMinute
      ),
    };
  }

  /**
   * Oyun saatini HH:mm biçiminde döndürür.
   */
  public static formatGameTime(hour: number, minute: number): string {
    const h = Math.max(0, Math.min(23, Math.floor(hour)));
    const m = Math.max(0, Math.min(59, Math.floor(minute)));
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  public static sanitizeRealMinutesPerDay(
    value: number
  ): RealMinutesPerGameDayOption {
    if (value === 15 || value === 30 || value === 45 || value === 60) {
      return value;
    }
    return GameClockEngine.DEFAULT_REAL_MINUTES_PER_GAME_DAY;
  }

  public static sanitizeTimeScale(scale: number): TimeScaleOption {
    if (scale === 0 || scale === 1 || scale === 2) {
      return scale;
    }
    // Eski kayıtlarda 4x vardı; artık en hızlı seçenek 2x.
    if (scale === 4) return 2;
    return 1;
  }

  /**
   * Gerçek zaman farkını (saniye) deterministik olarak oyun dakikasına dönüştürür.
   * Formül:
   *   gameMinutes = (realSeconds / (realMinutesPerGameDay * 60)) * 1440 * effectiveScale
   *               = (realSeconds * 24 / realMinutesPerGameDay) * effectiveScale
   */
  public static realSecondsToGameMinutes(
    realSeconds: number,
    realMinutesPerGameDay: RealMinutesPerGameDayOption = GameClockEngine.DEFAULT_REAL_MINUTES_PER_GAME_DAY,
    timeScale: TimeScaleOption = 1,
    isPaused: boolean = false
  ): number {
    if (
      isPaused ||
      timeScale <= 0 ||
      !Number.isFinite(realSeconds) ||
      realSeconds <= 0
    ) {
      return 0;
    }
    const validRealMins =
      GameClockEngine.sanitizeRealMinutesPerDay(realMinutesPerGameDay);
    const validScale = GameClockEngine.sanitizeTimeScale(timeScale);
    const rawMinutes = ((realSeconds * 24) / validRealMins) * validScale;
    return Number(rawMinutes.toFixed(6));
  }

  /**
   * Çevrimdışı sürede geçen gerçek saniyeyi (1x ölçeğinde) oyun dakikasına çevirir
   * ve maksimum çevrimdışı ilerleme sınırını (varsayılan 3 oyun günü = 4320 dk) uygular.
   */
  public static computeCappedOfflineGameMinutes(
    realSecondsElapsed: number,
    realMinutesPerGameDay: RealMinutesPerGameDayOption = GameClockEngine.DEFAULT_REAL_MINUTES_PER_GAME_DAY,
    maxOfflineDays: number = GameClockEngine.MAX_OFFLINE_GAME_DAYS
  ): {
    rawGameMinutes: number;
    cappedGameMinutes: number;
    wasCapped: boolean;
  } {
    if (!Number.isFinite(realSecondsElapsed) || realSecondsElapsed <= 0) {
      return { rawGameMinutes: 0, cappedGameMinutes: 0, wasCapped: false };
    }
    const rawGameMinutes = Math.floor(
      GameClockEngine.realSecondsToGameMinutes(
        realSecondsElapsed,
        realMinutesPerGameDay,
        1,
        false
      )
    );
    const maxMinutes = Math.max(
      0,
      Math.floor(maxOfflineDays * GameClockEngine.MINUTES_PER_GAME_DAY)
    );
    const cappedGameMinutes = Math.min(rawGameMinutes, maxMinutes);
    return {
      rawGameMinutes,
      cappedGameMinutes,
      wasCapped: rawGameMinutes > maxMinutes,
    };
  }

  /**
   * İki ISO zaman damgası arasındaki gerçek saniye farkını güvenli biçimde hesaplar.
   * Negatif, NaN, Infinity veya mantık dışı (>1 gerçek yıl) zaman farklarını reddeder.
   */
  public static parseAndValidateTimestampDiff(
    lastTimestampISO: string,
    currentTimestampISO: string
  ): {
    valid: boolean;
    realSecondsElapsed: number;
    warning?: string;
  } {
    if (
      typeof lastTimestampISO !== 'string' ||
      typeof currentTimestampISO !== 'string' ||
      !lastTimestampISO.trim() ||
      !currentTimestampISO.trim()
    ) {
      return {
        valid: false,
        realSecondsElapsed: 0,
        warning: 'Geçersiz veya boş zaman damgası.',
      };
    }

    const lastMs = Date.parse(lastTimestampISO);
    const currentMs = Date.parse(currentTimestampISO);

    if (!Number.isFinite(lastMs) || !Number.isFinite(currentMs)) {
      return {
        valid: false,
        realSecondsElapsed: 0,
        warning: 'Zaman damgası çözümlenemedi (NaN).',
      };
    }

    const diffMs = currentMs - lastMs;
    if (diffMs < 0) {
      return {
        valid: false,
        realSecondsElapsed: 0,
        warning:
          'Cihaz saati geriye alınmış; negatif zaman farkı işlenmedi.',
      };
    }

    const realSecondsElapsed = diffMs / 1000;
    if (
      !Number.isFinite(realSecondsElapsed) ||
      realSecondsElapsed > GameClockEngine.MAX_REAL_SECONDS_SANITY_LIMIT
    ) {
      return {
        valid: false,
        realSecondsElapsed: 0,
        warning:
          'Çok büyük veya geçersiz gerçek zaman farkı tespit edildi; güvenlik sınırı nedeniyle reddedildi.',
      };
    }

    return {
      valid: true,
      realSecondsElapsed,
    };
  }

  /**
   * Mevcut oyun dakikasına göre bir sonraki önemli seans/gün sonu olayını ve kalan süreyi döndürür.
   */
  public static getNextScheduledEvent(minutesIntoDay: number): {
    eventLabelTR: string;
    remainingGameMinutes: number;
    formattedRemaining: string;
  } {
    const min = GameClockEngine.normalizeMinuteOfDay(minutesIntoDay);
    let targetMinute = GameClockEngine.MINUTES_PER_GAME_DAY;
    let eventLabelTR = 'Gün Sonu Kapanışı (24:00)';

    if (min < 9 * 60) {
      targetMinute = 10 * 60;
      eventLabelTR = 'Piyasa Açılışına (10:00)';
    } else if (min < 10 * 60) {
      targetMinute = 10 * 60;
      eventLabelTR = 'Piyasa Açılışına (10:00)';
    } else if (min < 18 * 60) {
      targetMinute = 18 * 60;
      eventLabelTR = 'Piyasa Kapanışına (18:00)';
    } else {
      targetMinute = GameClockEngine.MINUTES_PER_GAME_DAY;
      eventLabelTR = 'Gün Sonu Kapanışına (00:00)';
    }

    const remainingGameMinutes = Math.max(1, targetMinute - min);
    const hours = Math.floor(remainingGameMinutes / 60);
    const mins = remainingGameMinutes % 60;
    const formattedRemaining =
      hours > 0 ? `${hours} sa ${mins} dk` : `${mins} dk`;

    return {
      eventLabelTR,
      remainingGameMinutes,
      formattedRemaining,
    };
  }
}

