/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GÖRSEL KALİTE (PERFORMANS MODU) VE UI SES AYARLARI YÖNETİCİSİ
 * - Ekonomik SimulationState içine yazılmaz; tamamen ayrı bir localStorage anahtarında saklanır.
 * - Görsel kalite seviyesi (Düşük / Orta / Yüksek) yalnızca araç/yaya sayısı, gölge ve efektleri etkiler.
 * - Ses altyapısı ayarları (masterVolume, effectsVolume, musicVolume, isMuted) kalıcı olarak saklanır;
 *   harici ses dosyası bulunmadığında sahte ses çalmaz ve durumu açıkça raporlar.
 */

export type GraphicsQualityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AudioSettingsState {
  masterVolume: number; // 0..100
  effectsVolume: number; // 0..100
  musicVolume: number; // 0..100
  isMuted: boolean;
}

export type CityZoomPresetSetting = 'CLOSER' | 'NORMAL' | 'OVERVIEW';

export interface UISettingsState {
  graphicsQuality: GraphicsQualityLevel;
  audio: AudioSettingsState;
  hasOpenedBorsaBuilding: boolean;
  /** Gün dönünce (00:00) "Gün raporu" kapsülü çıksın mı? */
  showDayReport?: boolean;
  lastCameraPanX?: number;
  lastCameraPanY?: number;
  lastZoomPreset?: CityZoomPresetSetting;
}

export interface GraphicsQualityProfile {
  level: GraphicsQualityLevel;
  labelTR: string;
  descriptionTR: string;
  maxVehicles: number;
  maxCityTrafficVehicles: number;
  maxPedestrians: number;
  reducedShadows: boolean;
  reducedAtmosphereTransitions: boolean;
  particlesEnabled: boolean;
}

export const GRAPHICS_QUALITY_PROFILES: Record<
  GraphicsQualityLevel,
  GraphicsQualityProfile
> = {
  LOW: {
    level: 'LOW',
    labelTR: 'Düşük',
    descriptionTR:
      'Yaya animasyonları kapalı · En fazla 1 ana / 6 şehir aracı · Azaltılmış gölge · Parçacık efekti kapalı',
    maxVehicles: 1,
    maxCityTrafficVehicles: 6,
    maxPedestrians: 0,
    reducedShadows: true,
    reducedAtmosphereTransitions: true,
    particlesEnabled: false,
  },
  MEDIUM: {
    level: 'MEDIUM',
    labelTR: 'Orta',
    descriptionTR:
      'En fazla 2 ana / 12 şehir aracı · 2 yaya · Standart gölgeler · Hafif atmosfer geçişleri (Varsayılan)',
    maxVehicles: 2,
    maxCityTrafficVehicles: 12,
    maxPedestrians: 2,
    reducedShadows: false,
    reducedAtmosphereTransitions: false,
    particlesEnabled: false,
  },
  HIGH: {
    level: 'HIGH',
    labelTR: 'Yüksek',
    descriptionTR:
      'En fazla 3 ana / 18 şehir aracı · 4 yaya · Tam çevre hareketleri · Kontrollü açılış ve kutlama efektleri',
    maxVehicles: 3,
    maxCityTrafficVehicles: 18,
    maxPedestrians: 4,
    reducedShadows: false,
    reducedAtmosphereTransitions: false,
    particlesEnabled: true,
  },
};

export class UISettingsStore {
  public static readonly STORAGE_KEY = 'borsa_holding_ui_settings_v1';
  public static readonly SOUND_ASSETS_STATUS =
    'Ses dosyaları daha sonra eklenecek (Ayar altyapısı aktif, sahte ses çalınmaz).';

  public static getDefaultSettings(): UISettingsState {
    return {
      graphicsQuality: 'MEDIUM',
      audio: {
        masterVolume: 75,
        effectsVolume: 80,
        musicVolume: 60,
        isMuted: false,
      },
      hasOpenedBorsaBuilding: false,
      showDayReport: true,
      lastCameraPanX: 0,
      lastCameraPanY: 0,
      lastZoomPreset: 'NORMAL',
    };
  }

  public static sanitizeVolume(val: unknown, fallback: number): number {
    if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
    return Math.max(0, Math.min(100, Math.round(val)));
  }

  public static sanitizeGraphicsQuality(
    val: unknown
  ): GraphicsQualityLevel {
    if (val === 'LOW' || val === 'MEDIUM' || val === 'HIGH') {
      return val;
    }
    return 'MEDIUM';
  }

  public static sanitizeZoomPreset(val: unknown): CityZoomPresetSetting {
    if (val === 'CLOSER' || val === 'NORMAL' || val === 'OVERVIEW') {
      return val;
    }
    return 'NORMAL';
  }

  public static sanitizeSettings(raw: unknown): UISettingsState {
    const defaults = UISettingsStore.getDefaultSettings();
    if (!raw || typeof raw !== 'object') {
      return defaults;
    }
    const candidate = raw as Partial<UISettingsState>;
    const rawAudio =
      candidate.audio && typeof candidate.audio === 'object'
        ? candidate.audio
        : defaults.audio;

    return {
      graphicsQuality: UISettingsStore.sanitizeGraphicsQuality(
        candidate.graphicsQuality
      ),
      audio: {
        masterVolume: UISettingsStore.sanitizeVolume(
          rawAudio.masterVolume,
          defaults.audio.masterVolume
        ),
        effectsVolume: UISettingsStore.sanitizeVolume(
          rawAudio.effectsVolume,
          defaults.audio.effectsVolume
        ),
        musicVolume: UISettingsStore.sanitizeVolume(
          rawAudio.musicVolume,
          defaults.audio.musicVolume
        ),
        isMuted:
          typeof rawAudio.isMuted === 'boolean'
            ? rawAudio.isMuted
            : defaults.audio.isMuted,
      },
      hasOpenedBorsaBuilding:
        typeof candidate.hasOpenedBorsaBuilding === 'boolean'
          ? candidate.hasOpenedBorsaBuilding
          : false,
      showDayReport:
        typeof candidate.showDayReport === 'boolean' ? candidate.showDayReport : true,
      lastCameraPanX:
        typeof candidate.lastCameraPanX === 'number' &&
        Number.isFinite(candidate.lastCameraPanX)
          ? Math.round(candidate.lastCameraPanX)
          : 0,
      lastCameraPanY:
        typeof candidate.lastCameraPanY === 'number' &&
        Number.isFinite(candidate.lastCameraPanY)
          ? Math.round(candidate.lastCameraPanY)
          : 0,
      lastZoomPreset: UISettingsStore.sanitizeZoomPreset(
        candidate.lastZoomPreset
      ),
    };
  }

  public static loadSettings(customStorage?: Storage): UISettingsState {
    const storage =
      customStorage ||
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!storage) {
      return UISettingsStore.getDefaultSettings();
    }
    try {
      const rawJson = storage.getItem(UISettingsStore.STORAGE_KEY);
      if (!rawJson) {
        return UISettingsStore.getDefaultSettings();
      }
      const parsed: unknown = JSON.parse(rawJson);
      return UISettingsStore.sanitizeSettings(parsed);
    } catch {
      return UISettingsStore.getDefaultSettings();
    }
  }

  public static saveSettings(
    next: UISettingsState,
    customStorage?: Storage
  ): UISettingsState {
    const sanitized = UISettingsStore.sanitizeSettings(next);
    const storage =
      customStorage ||
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (storage) {
      try {
        storage.setItem(
          UISettingsStore.STORAGE_KEY,
          JSON.stringify(sanitized)
        );
      } catch {
        // Kotadan dolayı yazılamazsa bellek içi ayar korunur
      }
    }
    return sanitized;
  }

  public static getGraphicsProfile(
    level: GraphicsQualityLevel
  ): GraphicsQualityProfile {
    return (
      GRAPHICS_QUALITY_PROFILES[level] || GRAPHICS_QUALITY_PROFILES.MEDIUM
    );
  }

  public static setGraphicsQuality(
    quality: GraphicsQualityLevel,
    customStorage?: Storage
  ): UISettingsState {
    const current = UISettingsStore.loadSettings(customStorage);
    return UISettingsStore.saveSettings(
      {
        ...current,
        graphicsQuality: quality,
      },
      customStorage
    );
  }

  public static updateCameraState(
    camera: {
      panX: number;
      panY: number;
      zoomPreset: CityZoomPresetSetting;
    },
    customStorage?: Storage
  ): UISettingsState {
    const current = UISettingsStore.loadSettings(customStorage);
    return UISettingsStore.saveSettings(
      {
        ...current,
        lastCameraPanX: Math.round(camera.panX),
        lastCameraPanY: Math.round(camera.panY),
        lastZoomPreset: camera.zoomPreset,
      },
      customStorage
    );
  }

  public static updateAudio(
    patch: Partial<AudioSettingsState>,
    customStorage?: Storage
  ): UISettingsState {
    const current = UISettingsStore.loadSettings(customStorage);
    return UISettingsStore.saveSettings(
      {
        ...current,
        audio: {
          ...current.audio,
          ...patch,
        },
      },
      customStorage
    );
  }

  public static markBorsaBuildingOpened(
    customStorage?: Storage
  ): UISettingsState {
    const current = UISettingsStore.loadSettings(customStorage);
    if (current.hasOpenedBorsaBuilding) return current;
    return UISettingsStore.saveSettings(
      {
        ...current,
        hasOpenedBorsaBuilding: true,
      },
      customStorage
    );
  }
}

export function getGraphicsQualityProfile(
  level: GraphicsQualityLevel
): GraphicsQualityProfile {
  return UISettingsStore.getGraphicsProfile(level);
}

