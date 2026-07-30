import Tts from 'react-native-tts';
import {APP_CONFIG} from '@/config/app';
import {translate} from '@/i18n';
import {useSettingsStore} from '@/store/useSettingsStore';
import {Station} from '@/types';

let inited = false;
let lastLang: string | null = null;

async function ensureReady(): Promise<boolean> {
  try {
    await Tts.getInitStatus();
    if (!inited) {
      await Tts.setDucking(true);
      // iOS：静音开关打开时仍可播报（地铁场景常见）
      await Tts.setIgnoreSilentSwitch('ignore');
      inited = true;
    }
    return true;
  } catch {
    return false;
  }
}

function stationDisplayName(station: Station, lang: 'zh' | 'en'): string {
  if (lang === 'en') {
    return station.nameEn || station.name;
  }
  return station.name || station.nameEn;
}

/**
 * 进入站点围栏时语音播报站名。
 * 受 APP_CONFIG.arrivalAnnounce.enabled 与用户设置双重控制。
 */
export async function announceStationArrival(station: Station): Promise<void> {
  if (!APP_CONFIG.arrivalAnnounce.enabled) return;
  const {notification, language} = useSettingsStore.getState();
  if (!notification.arrivalAnnounce) return;

  const name = stationDisplayName(station, language);
  if (!name) return;

  const text = translate(language, 'trip.arrivalAnnounce', {name});
  const locale = language === 'zh' ? 'zh-CN' : 'en-US';

  try {
    const ok = await ensureReady();
    if (!ok) return;
    if (lastLang !== locale) {
      await Tts.setDefaultLanguage(locale);
      lastLang = locale;
    }
    await Tts.stop();
    Tts.speak(text);
  } catch {
    // 播报失败不影响行程
  }
}

/** 结束行程或离开页面时停止播报 */
export function stopArrivalAnnounce(): void {
  Tts.stop().catch(() => undefined);
}
