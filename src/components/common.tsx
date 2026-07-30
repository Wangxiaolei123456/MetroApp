import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {radius, spacing, typography} from '@/theme/theme';
import {useTheme} from '@/theme/ThemeProvider';
import {AnimatedProgressBar, CrossfadeNumber} from '@/components/motion';

/* ---------------- 页面头部 ---------------- */

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const {colors} = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const canBack = navigation.canGoBack?.() ?? false;
  return (
    <View
      style={{
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
      {canBack && (
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={({pressed}) => [
            {
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.elevated,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.md,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <Text style={{fontSize: 20, color: colors.text, marginTop: -2}}>‹</Text>
        </Pressable>
      )}
      <View style={{flex: 1}}>
        <Text
          style={{
            fontSize: typography.title,
            fontWeight: '800',
            color: colors.text,
            letterSpacing: -0.3,
          }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{fontSize: typography.sub, color: colors.textSub, marginTop: 2}}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

/* ---------------- 卡片 ---------------- */

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const {colors} = useTheme();
  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({pressed}) => [base, pressed && {opacity: 0.9, transform: [{scale: 0.99}]}]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

export function HeroCard({
  children,
  style,
  color,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const {colors, shadows} = useTheme();
  const bg = color ?? colors.primaryDark;
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.xl,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.md,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
        },
        shadows.primary,
        style,
      ]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -80,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: 'rgba(0,212,200,0.12)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 30,
          right: 60,
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -50,
          left: -30,
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: 'rgba(0,0,0,0.2)',
        }}
      />
      <View style={{padding: spacing.lg}}>{children}</View>
    </View>
  );
}

export function SectionTitle({children, right}: {children: React.ReactNode; right?: React.ReactNode}) {
  const {colors} = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: spacing.lg,
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
      }}>
      <Text style={{fontSize: typography.h2, fontWeight: '700', color: colors.text}}>{children}</Text>
      {right}
    </View>
  );
}

/* ---------------- 按钮 ---------------- */

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'go' | 'ghost' | 'danger' | 'soft';
  size?: 'md' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const {colors, shadows} = useTheme();
  const palette = {
    primary: {bg: colors.primary, fg: colors.textOnBrand, border: 'transparent'},
    go: {bg: colors.go, fg: colors.goText, border: 'transparent'},
    danger: {bg: colors.danger, fg: colors.textOnBrand, border: 'transparent'},
    ghost: {bg: 'transparent', fg: colors.primaryBright, border: colors.primary + '66'},
    soft: {bg: colors.primarySoft, fg: colors.primaryBright, border: 'transparent'},
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        {
          backgroundColor: palette.bg,
          borderRadius: radius.full,
          paddingVertical: size === 'sm' ? spacing.sm : 14,
          paddingHorizontal: spacing.xl,
          borderWidth: variant === 'ghost' ? 1.5 : 0,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: pressed && !disabled ? [{scale: 0.98}] : [],
          alignItems: 'center',
          justifyContent: 'center',
          marginHorizontal: spacing.lg,
          marginBottom: spacing.md,
        },
        variant === 'primary' && !disabled ? shadows.primary : null,
        variant === 'go' && !disabled ? shadows.go : null,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text
          style={{
            color: palette.fg,
            fontWeight: '800',
            fontSize: size === 'sm' ? typography.sub : typography.body,
            letterSpacing: variant === 'go' ? 0.6 : 0.2,
          }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/* ---------------- 列表 / 行 ---------------- */

export function Row({
  label,
  value,
  style,
}: {
  label: string;
  value?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const {colors} = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        style,
      ]}>
      <Text style={{fontSize: typography.body, color: colors.textSub}}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={{fontSize: typography.body, color: colors.text, fontWeight: '600'}}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

export function IconBubble({
  icon,
  color,
  size = 38,
}: {
  icon: string;
  color?: string;
  size?: number;
}) {
  const {colors} = useTheme();
  const c = color ?? colors.primary;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: c.length === 7 ? c + '22' : c,
        borderWidth: 1,
        borderColor: c.length === 7 ? c + '44' : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{fontSize: size * 0.5}}>{icon}</Text>
    </View>
  );
}

export function ListItem({
  icon,
  label,
  sub,
  onPress,
  color,
  last,
}: {
  icon: string;
  label: string;
  sub?: string;
  onPress: () => void;
  color?: string;
  last?: boolean;
}) {
  const {colors} = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: pressed ? colors.pressed : 'transparent',
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      })}>
      <IconBubble icon={icon} color={color ?? colors.primary} />
      <View style={{flex: 1, marginLeft: spacing.md}}>
        <Text style={{color: colors.text, fontSize: typography.body, fontWeight: '600'}}>{label}</Text>
        {sub && (
          <Text style={{color: colors.textFaint, fontSize: typography.caption, marginTop: 1}}>{sub}</Text>
        )}
      </View>
      <Text style={{color: colors.textFaint, fontSize: 18}}>›</Text>
    </Pressable>
  );
}

/* ---------------- 进度条 / 指标 ---------------- */

/** 带动画的进度线绘制（兼容原 ProgressBar API） */
export function ProgressBar({
  pct,
  color,
  height = 8,
  style,
}: {
  pct: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const {colors} = useTheme();
  return (
    <AnimatedProgressBar
      pct={pct}
      color={color ?? colors.primary}
      height={height}
      style={style}
    />
  );
}

export function Stat({
  value,
  label,
  color,
  labelColor,
  animate,
}: {
  value: string;
  label: string;
  color?: string;
  labelColor?: string;
  /** 开启数字 crossover 动效 */
  animate?: boolean;
}) {
  const {colors} = useTheme();
  const c = color ?? colors.primary;
  const lc =
    labelColor ??
    (c === colors.white || c === colors.textOnBrand ? 'rgba(255,255,255,0.7)' : colors.textSub);
  const numStyle = {
    fontSize: 20,
    fontWeight: '800' as const,
    color: c,
    fontVariant: ['tabular-nums' as const],
  };
  return (
    <View style={{alignItems: 'center', flex: 1}}>
      {animate ? (
        <CrossfadeNumber value={value} style={numStyle} height={28} />
      ) : (
        <Text style={numStyle}>{value}</Text>
      )}
      <Text style={{fontSize: typography.caption, color: lc, marginTop: 2}}>{label}</Text>
    </View>
  );
}

/* ---------------- 空态 / 标签 ---------------- */

export function Empty({text, icon = '🍃'}: {text: string; icon?: string}) {
  const {colors} = useTheme();
  return (
    <View style={{padding: spacing.xxl, alignItems: 'center'}}>
      <Text style={{fontSize: 34, marginBottom: spacing.sm}}>{icon}</Text>
      <Text style={{color: colors.textFaint, fontSize: typography.sub}}>{text}</Text>
    </View>
  );
}

export function Chip({
  text,
  color,
}: {
  text: string;
  color?: string;
}) {
  const {colors} = useTheme();
  const c = color ?? colors.primary;
  return (
    <View
      style={{
        backgroundColor: c.length === 7 ? c + '22' : colors.primarySoft,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 3,
        borderRadius: radius.full,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: c.length === 7 ? c + '44' : colors.border,
      }}>
      <Text style={{color: c, fontSize: typography.caption, fontWeight: '700', letterSpacing: 0.2}}>
        {text}
      </Text>
    </View>
  );
}

export function Text_({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const {colors} = useTheme();
  return <Text style={[{color: colors.text}, style]}>{children}</Text>;
}
