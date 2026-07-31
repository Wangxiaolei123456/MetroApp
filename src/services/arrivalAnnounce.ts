import {translate} from '@/i18n';
import {useSettingsStore} from '@/store/useSettingsStore';
import {usePlanStore} from '@/store/usePlanStore';
import {useTripStore} from '@/store/useTripStore';
import {RoutePlan, Station, StationAlert, StationAlertKind} from '@/types';

export type {StationAlert, StationAlertKind};

let lastAlertKey = '';
let lastAlertAt = 0;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
const DEDUPE_MS = 20_000;
const BANNER_MS = 12_000;

function stationDisplayName(station: Station, lang: 'zh' | 'en'): string {
  if (lang === 'en') return station.nameEn || station.name;
  return station.name || station.nameEn;
}

function matchStationIdByName(name: string, stations: Station[]): string | undefined {
  const n = name.trim();
  if (!n) return undefined;
  return stations.find((s) => s.name === n || s.nameEn === n || s.id === n)?.id;
}

export function getTransferInfo(
  plan: RoutePlan,
  stations: Station[],
): Map<string, {nextLineName: string}> {
  const map = new Map<string, {nextLineName: string}>();
  for (let i = 0; i < plan.legs.length - 1; i++) {
    const leg = plan.legs[i];
    const next = plan.legs[i + 1];
    let transferId: string | undefined;
    if (leg.stationIds.length > 0) {
      transferId = leg.stationIds[leg.stationIds.length - 1];
    } else if (leg.stationNames && leg.stationNames.length > 0) {
      transferId = matchStationIdByName(leg.stationNames[leg.stationNames.length - 1], stations);
    }
    if (!transferId) continue;
    map.set(transferId, {nextLineName: next.lineName || next.lineId});
  }
  return map;
}

export function buildStationAlert(
  station: Station,
  stations: Station[],
  opts?: {isFirstStop?: boolean},
): StationAlert {
  const {language} = useSettingsStore.getState();
  const name = stationDisplayName(station, language);
  const plan = usePlanStore.getState().plan;

  if (plan && station.id === plan.toStationId) {
    return {
      kind: 'destination',
      stationId: station.id,
      stationName: name,
      message: translate(language, 'trip.alert.destination', {name}),
    };
  }

  if (plan) {
    const transfers = getTransferInfo(plan, stations);
    const info = transfers.get(station.id);
    if (info) {
      return {
        kind: 'transfer',
        stationId: station.id,
        stationName: name,
        nextLineName: info.nextLineName,
        message: info.nextLineName
          ? translate(language, 'trip.alert.transferLine', {name, line: info.nextLineName})
          : translate(language, 'trip.alert.transfer', {name}),
      };
    }
  } else if (station.isTransfer) {
    return {
      kind: 'transfer',
      stationId: station.id,
      stationName: name,
      message: translate(language, 'trip.alert.transfer', {name}),
    };
  }

  if (opts?.isFirstStop) {
    return {
      kind: 'boarded',
      stationId: station.id,
      stationName: name,
      message: translate(language, 'trip.alert.boarded', {name}),
    };
  }

  return {
    kind: 'arrival',
    stationId: station.id,
    stationName: name,
    message: translate(language, 'trip.alert.arrival', {name}),
  };
}

function showBanner(alert: StationAlert): void {
  useTripStore.getState().setStationAlert(alert);
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => {
    useTripStore.getState().setStationAlert(null);
    dismissTimer = null;
  }, BANNER_MS);
}

/** 进站横幅提醒（地铁场景静音，仅 UI，无语音） */
export function notifyStationAlert(
  station: Station,
  stations: Station[],
  opts?: {isFirstStop?: boolean},
): StationAlert | null {
  const {notification} = useSettingsStore.getState();
  if (notification.tripAlert === false) return null;

  const alert = buildStationAlert(station, stations, opts);
  const key = `${alert.kind}:${alert.stationId}`;
  const now = Date.now();
  if (key === lastAlertKey && now - lastAlertAt < DEDUPE_MS) return null;
  lastAlertKey = key;
  lastAlertAt = now;

  showBanner(alert);
  return alert;
}

export function clearStationAlert(): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  useTripStore.getState().setStationAlert(null);
}
