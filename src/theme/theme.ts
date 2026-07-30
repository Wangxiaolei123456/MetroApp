import {Platform, TextStyle, ViewStyle} from 'react-native';

export const colors = {
  primary: '#2F6BFF',
  primaryDark: '#1E4FD6',
  primarySoft: '#EAF0FF', // 品牌浅底（图标气泡 / 选中态背景）
  accent: '#7C5CFF',
  background: '#F4F6FB',
  card: '#FFFFFF',
  text: '#101828',
  textSub: '#667085',
  textFaint: '#98A2B3',
  border: '#EAECF2',
  success: '#12B76A',
  successSoft: '#E8F8F0',
  warning: '#F59E0B',
  warningSoft: '#FEF4E6',
  danger: '#F04438',
  dangerSoft: '#FEECEB',
  gold: '#F5B301',
  silver: '#9AA5B1',
  bronze: '#C9793C',
  black: '#000000',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const typography = {
  hero: 34,
  title: 24,
  h2: 17,
  body: 15,
  sub: 13,
  caption: 11,
};

// 跨平台阴影（iOS shadow / Android elevation）
function makeShadow(opacity: number, blur: number, y: number, elevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#101828',
      shadowOpacity: opacity,
      shadowRadius: blur,
      shadowOffset: {width: 0, height: y},
    },
    default: {elevation},
  }) as ViewStyle;
}

export const shadows = {
  /** 普通卡片 */
  card: makeShadow(0.06, 12, 4, 2),
  /** 悬浮元素（浮层 / Tab 栏 / 主按钮） */
  float: makeShadow(0.12, 20, 8, 6),
  /** 彩色主按钮投影 */
  primary: Platform.select<ViewStyle>({
    ios: {
      shadowColor: colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: {width: 0, height: 6},
    },
    default: {elevation: 4},
  }) as ViewStyle,
};

export const textStyles: Record<string, TextStyle> = {
  title: {fontSize: typography.title, fontWeight: '800', color: colors.text, letterSpacing: 0.2},
  h2: {fontSize: typography.h2, fontWeight: '700', color: colors.text},
  body: {fontSize: typography.body, color: colors.text},
  sub: {fontSize: typography.sub, color: colors.textSub},
  caption: {fontSize: typography.caption, color: colors.textFaint},
};

export const theme = {colors, spacing, radius, typography, shadows, textStyles};
