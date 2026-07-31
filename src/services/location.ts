import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation, {GeoError, GeoPosition, PositionError} from 'react-native-geolocation-service';
import {GeoPoint} from '@/types';
import {t} from '@/i18n';

// 沙箱/无 GPS 时启用模拟轨迹（沿示例城市线路缓慢移动）
const LOCATION_MOCK = false;

export interface LocationWatcher {
  remove: () => void;
}

export type GetLocationOptions = {
  /**
   * true：不使用缓存，强制重新定位（模拟器改点 /「重新定位」应用）。
   * false/默认：允许极短 GPS 缓存，信号差时网络可稍长缓存。
   */
  fresh?: boolean;
};

type LocOpts = {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  showLocationDialog?: boolean;
  forceRequestLocation?: boolean;
  /** Android：绕过 Google Fused，走系统 LocationManager（国内机更稳） */
  forceLocationManager?: boolean;
  accuracy?: {
    android?: 'high' | 'balanced' | 'low' | 'passive';
    ios?: 'bestForNavigation' | 'best' | 'nearestTenMeters' | 'hundredMeters' | 'kilometer' | 'threeKilometers' | 'reduced';
  };
};

/**
 * 定位策略：优先 GPS；GPS 超时/不可用时再降级网络/Wi‑Fi 粗定位。
 * maximumAge 刻意偏短：模拟器改点时若缓存过长，会一直返回旧 GPS lastKnown。
 */
function buildAttempts(fresh: boolean): LocOpts[] {
  const gpsAge = fresh ? 0 : 5_000;
  const networkAge = fresh ? 0 : 60_000;
  const androidBase = {
    forceLocationManager: true,
    showLocationDialog: false,
    forceRequestLocation: true,
  } as const;

  if (Platform.OS === 'android') {
    return [
      {
        ...androidBase,
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: gpsAge,
        accuracy: {android: 'high'},
      },
      {
        ...androidBase,
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: networkAge,
        accuracy: {android: 'balanced'},
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: networkAge,
        showLocationDialog: false,
        forceRequestLocation: true,
        accuracy: {android: 'balanced'},
      },
    ];
  }

  return [
    {enableHighAccuracy: true, timeout: 15_000, maximumAge: gpsAge, accuracy: {ios: 'best'}},
    {
      enableHighAccuracy: false,
      timeout: 12_000,
      maximumAge: networkAge,
      accuracy: {ios: 'hundredMeters'},
    },
  ];
}

/** 显式申请定位权限（兼容 Android 12 的"大致位置"），未授予则抛错 */
async function ensurePermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    const status = await Geolocation.requestAuthorization('whenInUse');
    if (status === 'granted') return;
    if (status === 'disabled') {
      throw new Error(t('svc.loc.disabled'));
    }
    throw new Error(t('svc.loc.notGranted'));
  }

  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
  if ((await PermissionsAndroid.check(fine)) || (await PermissionsAndroid.check(coarse))) return;

  const results = await PermissionsAndroid.requestMultiple([fine, coarse]);
  const fineOk = results[fine] === PermissionsAndroid.RESULTS.GRANTED;
  const coarseOk = results[coarse] === PermissionsAndroid.RESULTS.GRANTED;
  if (fineOk || coarseOk) return;

  if (
    results[fine] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
    results[coarse] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
  ) {
    throw new Error(t('svc.loc.neverAsk'));
  }
  throw new Error(t('svc.loc.notGranted'));
}

function toPoint(pos: GeoPosition): GeoPoint {
  return {latitude: pos.coords.latitude, longitude: pos.coords.longitude};
}

function requestPosition(options: LocOpts): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve(toPoint(pos)),
      (err: GeoError) => reject(err),
      options,
    );
  });
}

function formatLocError(err: unknown): string {
  const e = err as GeoError | undefined;
  const code = e?.code;
  if (code === PositionError.TIMEOUT) return t('svc.loc.timeout');
  if (code === PositionError.SETTINGS_NOT_SATISFIED) return t('svc.loc.settings');
  if (code === PositionError.PLAY_SERVICE_NOT_AVAILABLE) return t('svc.loc.playServices');
  if (code === PositionError.POSITION_UNAVAILABLE) return t('svc.loc.unavailable');
  if (code === PositionError.PERMISSION_DENIED) return t('svc.loc.notGranted');
  return e?.message || t('svc.loc.failed');
}

/**
 * 获取当前位置：优先 GPS，失败后降级网络/Wi‑Fi 粗定位。
 * @param opts.fresh 为 true 时禁用缓存（模拟器改点、手动重新定位）
 */
export async function getCurrentLocation(opts?: GetLocationOptions): Promise<GeoPoint> {
  await ensurePermission();
  const attempts = buildAttempts(!!opts?.fresh);
  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      return await requestPosition(attempt);
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(formatLocError(lastErr));
}

export function watchLocation(
  onUpdate: (loc: GeoPoint) => void,
  onError?: (e: any) => void,
): LocationWatcher {
  if (LOCATION_MOCK) return mockWatch(onUpdate);
  let watchId: number | null = null;
  let cancelled = false;
  ensurePermission()
    .then(() => {
      if (cancelled) return;
      watchId = Geolocation.watchPosition(
        (pos) => onUpdate(toPoint(pos)),
        onError,
        {
          enableHighAccuracy: true,
          // 0：模拟器微小平移/瞬移也能立刻回调
          distanceFilter: 0,
          interval: 1000,
          fastestInterval: 500,
          ...(Platform.OS === 'android'
            ? {
                forceLocationManager: true,
                showLocationDialog: false,
                forceRequestLocation: true,
              }
            : {}),
        },
      ) as number;
    })
    .catch((e) => onError?.(e));
  return {
    remove: () => {
      cancelled = true;
      if (watchId != null) Geolocation.clearWatch(watchId);
    },
  };
}

/** 模拟沿一条直线来回移动，便于无设备时演示进站/站点计数 */
function mockWatch(onUpdate: (loc: GeoPoint) => void): LocationWatcher {
  const base = {latitude: 31.2304, longitude: 121.44};
  let tick = 0;
  const timer = setInterval(() => {
    tick += 1;
    const offset = Math.sin(tick / 10) * 0.056; // 沿经度方向摆动，覆盖 1 号线
    onUpdate({latitude: base.latitude, longitude: base.longitude + offset});
  }, 3000);
  return {remove: () => clearInterval(timer)};
}
