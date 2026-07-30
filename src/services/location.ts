import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {GeoPoint} from '@/types';
import {t} from '@/i18n';

// 沙箱/无 GPS 时启用模拟轨迹（沿示例城市线路缓慢移动）
const LOCATION_MOCK = false;

export interface LocationWatcher {
  remove: () => void;
}

/** 显式申请定位权限（兼容 Android 12 的"大致位置"），未授予则抛错 */
async function ensurePermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    // iOS：触发系统授权弹窗（whenInUse）
    Geolocation.requestAuthorization('whenInUse');
    return;
  }
  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
  if ((await PermissionsAndroid.check(fine)) || (await PermissionsAndroid.check(coarse))) return;

  const res = await PermissionsAndroid.request(fine, {
    title: t('svc.loc.permTitle'),
    message: t('svc.loc.permMsg'),
    buttonPositive: t('svc.loc.allow'),
    buttonNegative: t('svc.loc.deny'),
    buttonNeutral: t('svc.loc.later'),
  });
  if (res === PermissionsAndroid.RESULTS.GRANTED) return;
  // Android 12 用户可能只授予了"大致位置"（coarse），定位仍可用
  if (await PermissionsAndroid.check(coarse)) return;

  if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    throw new Error(t('svc.loc.neverAsk'));
  }
  throw new Error(t('svc.loc.notGranted'));
}

export function getCurrentLocation(): Promise<GeoPoint> {
  return ensurePermission().then(
    () =>
      new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(
          (pos) => resolve({latitude: pos.coords.latitude, longitude: pos.coords.longitude}),
          (err) => reject(new Error(err?.message || '定位失败')),
          {enableHighAccuracy: true, timeout: 15000, maximumAge: 1000},
        );
      }),
  );
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
        (pos) => onUpdate({latitude: pos.coords.latitude, longitude: pos.coords.longitude}),
        onError,
        {enableHighAccuracy: true, distanceFilter: 10, interval: 3000, fastestInterval: 1000},
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
  let t = 0;
  const timer = setInterval(() => {
    t += 1;
    const offset = Math.sin(t / 10) * 0.056; // 沿经度方向摆动，覆盖 1 号线
    onUpdate({latitude: base.latitude, longitude: base.longitude + offset});
  }, 3000);
  return {remove: () => clearInterval(timer)};
}
