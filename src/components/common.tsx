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
import {colors, radius, shadows, spacing, typography} from '@/theme/theme';

/* ---------------- 页面头部（含安全区 + 自动返回按钮） ---------------- */

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
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
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.md,
              opacity: pressed ? 0.7 : 1,
            },
            shadows.card,
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
            letterSpacing: 0.2,
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
  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    shadows.card,
    style,
  ];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({pressed}) => [base, pressed && {opacity: 0.9, transform: [{scale: 0.99}]}]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

/** 品牌深色 Hero 卡片：模拟渐变的装饰圆 + 深蓝底 */
export function HeroCard({
  children,
  style,
  color = colors.primary,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: color,
          borderRadius: radius.xl,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.md,
          overflow: 'hidden',
        },
        shadows.primary,
        style,
      ]}>
      {/* 装饰光斑，营造渐变质感 */}
      <View pointerEvents="none" style={{position: 'absolute', top: -70, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.10)'}} />
      <View pointerEvents="none" style={{position: 'absolute', top: 20, right: 40, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.08)'}} />
      <View pointerEvents="none" style={{position: 'absolute', bottom: -60, left: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(0,0,0,0.10)'}} />
      <View style={{padding: spacing.lg}}>{children}</View>
    </View>
  );
}

export function SectionTitle({children, right}: {children: React.ReactNode; right?: React.ReactNode}) {
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

/* ---------------- 按钮（按压反馈 + 尺寸/变体） ---------------- */

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
  variant?: 'primary' | 'ghost' | 'danger' | 'soft';
  size?: 'md' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: {bg: colors.primary, fg: colors.white, border: 'transparent'},
    danger: {bg: colors.danger, fg: colors.white, border: 'transparent'},
    ghost: {bg: colors.white, fg: colors.primary, border: colors.primary + '55'},
    soft: {bg: colors.primarySoft, fg: colors.primary, border: 'transparent'},
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
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: pressed && !disabled ? [{scale: 0.98}] : [],
          alignItems: 'center',
          justifyContent: 'center',
          marginHorizontal: spacing.lg,
          marginBottom: spacing.md,
        },
        variant === 'primary' && !disabled ? shadows.primary : null,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text
          style={{
            color: palette.fg,
            fontWeight: '700',
            fontSize: size === 'sm' ? typography.sub : typography.body,
            letterSpacing: 0.3,
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

/** 图标气泡 */
export function IconBubble({
  icon,
  color = colors.primary,
  size = 38,
}: {
  icon: string;
  color?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: color + '16',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{fontSize: size * 0.5}}>{icon}</Text>
    </View>
  );
}

/** 菜单列表项：图标气泡 + 标题 + 箭头 */
export function ListItem({
  icon,
  label,
  sub,
  onPress,
  color = colors.primary,
  last,
}: {
  icon: string;
  label: string;
  sub?: string;
  onPress: () => void;
  color?: string;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: pressed ? colors.background : 'transparent',
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      })}>
      <IconBubble icon={icon} color={color} />
      <View style={{flex: 1, marginLeft: spacing.md}}>
        <Text style={{color: colors.text, fontSize: typography.body, fontWeight: '600'}}>{label}</Text>
        {sub && <Text style={{color: colors.textFaint, fontSize: typography.caption, marginTop: 1}}>{sub}</Text>}
      </View>
      <Text style={{color: colors.textFaint, fontSize: 18}}>›</Text>
    </Pressable>
  );
}

/* ---------------- 进度条 / 指标 ---------------- */

export function ProgressBar({
  pct,
  color = colors.primary,
  height = 8,
  style,
}: {
  pct: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View
      style={[
        {height, backgroundColor: '#EEF1F6', borderRadius: height / 2, overflow: 'hidden'},
        style,
      ]}>
      <View
        style={{
          width: `${clamped}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** 数值指标（大数字 + 小标签） */
export function Stat({
  value,
  label,
  color = colors.primary,
  labelColor,
}: {
  value: string;
  label: string;
  color?: string;
  labelColor?: string;
}) {
  const lc = labelColor ?? (color === colors.white ? 'rgba(255,255,255,0.75)' : colors.textSub);
  return (
    <View style={{alignItems: 'center', flex: 1}}>
      <Text style={{fontSize: 20, fontWeight: '800', color}}>{value}</Text>
      <Text style={{fontSize: typography.caption, color: lc, marginTop: 2}}>{label}</Text>
    </View>
  );
}

/* ---------------- 空态 / 标签 ---------------- */

export function Empty({text, icon = '🍃'}: {text: string; icon?: string}) {
  return (
    <View style={{padding: spacing.xxl, alignItems: 'center'}}>
      <Text style={{fontSize: 34, marginBottom: spacing.sm}}>{icon}</Text>
      <Text style={{color: colors.textFaint, fontSize: typography.sub}}>{text}</Text>
    </View>
  );
}

export function Chip({
  text,
  color = colors.primary,
}: {
  text: string;
  color?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: color + '14',
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 3,
        borderRadius: radius.full,
        alignSelf: 'flex-start',
      }}>
      <Text style={{color, fontSize: typography.caption, fontWeight: '700'}}>{text}</Text>
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
  return <Text style={[{color: colors.text}, style]}>{children}</Text>;
}
