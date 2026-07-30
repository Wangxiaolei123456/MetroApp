import {Platform, TextStyle, ViewStyle} from 'react-native';

/** 品牌/语义色中主题不变的部分（模式色、勋章等） */
const brandShared = {
  primary: '#3D7EFF',
  primaryDark: '#2B5BFF',
  primaryBright: '#5B94FF',
  go: '#00C281',
  goDark: '#00A86E',
  goText: '#003322',
  accent: '#00D4C8',
  success: '#00C281',
  warning: '#FF8A00',
  danger: '#FF4D5E',
  gold: '#F5B301',
  silver: '#9AA5B1',
  bronze: '#C9793C',
  black: '#000000',
  white: '#FFFFFF',
  textOnBrand: '#FFFFFF',
} as const;

export type ThemeColors = {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  primaryBright: string;
  go: string;
  goDark: string;
  goSoft: string;
  goText: string;
  accent: string;
  accentSoft: string;
  background: string;
  card: string;
  elevated: string;
  pressed: string;
  text: string;
  textSub: string;
  textFaint: string;
  textOnBrand: string;
  border: string;
  borderStrong: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  gold: string;
  silver: string;
  bronze: string;
  black: string;
  white: string;
};

/** 深色科技仪表盘（默认） */
export const darkColors: ThemeColors = {
  ...brandShared,
  primarySoft: 'rgba(61,126,255,0.16)',
  goSoft: 'rgba(0,194,129,0.18)',
  accentSoft: 'rgba(0,212,200,0.16)',
  background: '#0B0F17',
  card: '#141A24',
  elevated: '#1C2433',
  pressed: '#222B3A',
  text: '#ECEEF3',
  textSub: '#8B95A8',
  textFaint: '#5C6678',
  border: '#262E3D',
  borderStrong: '#343E52',
  successSoft: 'rgba(0,194,129,0.16)',
  warningSoft: 'rgba(255,138,0,0.16)',
  dangerSoft: 'rgba(255,77,94,0.16)',
};

/** 浅色：干净画布，模式色仍保持高对比 */
export const lightColors: ThemeColors = {
  ...brandShared,
  primary: '#2B5BFF',
  primaryDark: '#1E45CC',
  primaryBright: '#2B5BFF',
  primarySoft: 'rgba(43,91,255,0.10)',
  goSoft: 'rgba(0,194,129,0.12)',
  accentSoft: 'rgba(0,168,197,0.12)',
  background: '#F4F5F8',
  card: '#FFFFFF',
  elevated: '#ECEEF3',
  pressed: '#E3E5EC',
  text: '#10131A',
  textSub: '#5A6473',
  textFaint: '#8A93A3',
  border: '#E3E5EC',
  borderStrong: '#D0D4DE',
  successSoft: 'rgba(0,194,129,0.12)',
  warningSoft: 'rgba(255,138,0,0.12)',
  dangerSoft: 'rgba(255,77,94,0.12)',
};

export const modeColors = {
  walk: '#00B894',
  bus: '#E8453C',
  metro: '#2B5BFF',
  rail: '#8E44D8',
  bike: '#00A8C5',
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

function makeShadow(opacity: number, blur: number, y: number, elevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: opacity,
      shadowRadius: blur,
      shadowOffset: {width: 0, height: y},
    },
    default: {elevation},
  }) as ViewStyle;
}

export function makeShadows(c: ThemeColors, isDark: boolean) {
  return {
    card: {
      borderWidth: 1,
      borderColor: c.border,
      ...(isDark ? makeShadow(0.35, 16, 4, 2) : makeShadow(0.08, 12, 4, 2)),
    } as ViewStyle,
    float: {
      borderWidth: 1,
      borderColor: c.borderStrong,
      ...(isDark ? makeShadow(0.45, 24, 8, 8) : makeShadow(0.12, 20, 8, 6)),
    } as ViewStyle,
    primary: Platform.select<ViewStyle>({
      ios: {
        shadowColor: c.primary,
        shadowOpacity: isDark ? 0.4 : 0.28,
        shadowRadius: 14,
        shadowOffset: {width: 0, height: 6},
      },
      default: {elevation: 4},
    }) as ViewStyle,
    go: Platform.select<ViewStyle>({
      ios: {
        shadowColor: c.go,
        shadowOpacity: isDark ? 0.45 : 0.3,
        shadowRadius: 14,
        shadowOffset: {width: 0, height: 6},
      },
      default: {elevation: 4},
    }) as ViewStyle,
  };
}

export function makeTextStyles(c: ThemeColors): Record<string, TextStyle> {
  return {
    title: {
      fontSize: typography.title,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.3,
    },
    h2: {fontSize: typography.h2, fontWeight: '700', color: c.text},
    body: {fontSize: typography.body, color: c.text},
    sub: {fontSize: typography.sub, color: c.textSub},
    caption: {fontSize: typography.caption, color: c.textFaint},
    eta: {
      fontSize: 26,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.3,
      fontVariant: ['tabular-nums'],
    },
  };
}

/** @deprecated 请用 useTheme().colors；保留默认深色供非组件模块兜底 */
export const colors = darkColors;

export const shadows = makeShadows(darkColors, true);
export const textStyles = makeTextStyles(darkColors);

export const theme = {
  colors,
  modeColors,
  spacing,
  radius,
  typography,
  shadows,
  textStyles,
};

export type ColorSchemePreference = 'system' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';
