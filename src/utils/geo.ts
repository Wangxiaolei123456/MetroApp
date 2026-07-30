import {Linking, Platform} from 'react-native';
import {GeoPoint} from '@/types';

const EARTH_RADIUS = 6371000; // 米

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 两点间球面距离（米） */
export function haversine(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

/** 判断点 p 是否在点 center 半径 radius 米范围内（地理围栏判定核心） */
export function isWithinRadius(
  p: GeoPoint,
  center: GeoPoint,
  radius: number,
): boolean {
  return haversine(p, center) <= radius;
}

/** 最近距离（米） */
export function distanceTo(p: GeoPoint, center: GeoPoint): number {
  return haversine(p, center);
}

/**
 * 由连续轨迹点估算瞬时速度（米/秒）
 * 取最近两点的位移 / 时间差
 */
export function estimateSpeed(
  prev: {at: number; location: GeoPoint},
  curr: {at: number; location: GeoPoint},
): number {
  const dt = (curr.at - prev.at) / 1000; // 秒
  if (dt <= 0) return 0;
  return haversine(prev.location, curr.location) / dt;
}

/**
 * 唤起外部地图 App 进行步行导航
 * iOS 使用 Apple Maps，Android 使用 Google Maps 步行导航
 */
export async function openWalkNavigation(from: GeoPoint, to: GeoPoint): Promise<void> {
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?saddr=${from.latitude},${from.longitude}&daddr=${to.latitude},${to.longitude}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}`;
  try {
    await Linking.openURL(url);
  } catch {
    // 忽略：用户取消或无可用地图 App
  }
}
