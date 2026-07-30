import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {AccessibilityInfo, Appearance, ColorSchemeName, StatusBar} from 'react-native';
import {DarkTheme, DefaultTheme, Theme as NavTheme} from '@react-navigation/native';
import {
  ColorSchemePreference,
  ResolvedScheme,
  ThemeColors,
  darkColors,
  lightColors,
  makeShadows,
  makeTextStyles,
} from '@/theme/theme';
import {useSettingsStore} from '@/store/useSettingsStore';

type ThemeContextValue = {
  colors: ThemeColors;
  scheme: ResolvedScheme;
  preference: ColorSchemePreference;
  isDark: boolean;
  reduceMotion: boolean;
  shadows: ReturnType<typeof makeShadows>;
  textStyles: ReturnType<typeof makeTextStyles>;
  navTheme: NavTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(pref: ColorSchemePreference, system: ColorSchemeName): ResolvedScheme {
  if (pref === 'light' || pref === 'dark') return pref;
  return system === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const preference = useSettingsStore((s) => s.colorScheme);
  const [system, setSystem] = useState<ColorSchemeName>(Appearance.getColorScheme());
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({colorScheme}) => setSystem(colorScheme));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const scheme = resolveScheme(preference, system);
    const isDark = scheme === 'dark';
    const colors = isDark ? darkColors : lightColors;
    const shadows = makeShadows(colors, isDark);
    const textStyles = makeTextStyles(colors);
    const base = isDark ? DarkTheme : DefaultTheme;
    const navTheme: NavTheme = {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        notification: colors.go,
      },
    };
    return {colors, scheme, preference, isDark, reduceMotion, shadows, textStyles, navTheme};
  }, [preference, system, reduceMotion]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={value.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={value.colors.background}
        translucent={false}
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // 兜底：Provider 外（极少）用深色
    return {
      colors: darkColors,
      scheme: 'dark',
      preference: 'dark',
      isDark: true,
      reduceMotion: false,
      shadows: makeShadows(darkColors, true),
      textStyles: makeTextStyles(darkColors),
      navTheme: DarkTheme,
    };
  }
  return ctx;
}

/** 按当前主题生成 StyleSheet，主题切换时自动重建 */
export function useThemedStyles<T>(factory: (colors: ThemeColors, isDark: boolean) => T): T {
  const {colors, isDark} = useTheme();
  // factory 由调用方保持稳定（模块级函数）；仅随主题重建
  return useMemo(() => factory(colors, isDark), [colors, isDark]);
}
