import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import {useTheme} from '@/theme/ThemeProvider';

/* ---------------- 进度线绘制 ---------------- */

/**
 * 进度条：宽度从 0 绘制到目标百分比（Citymapper 风格 progress-line draw）。
 * Reduce Motion 开启时直接到位。
 */
export function AnimatedProgressBar({
  pct,
  color,
  height = 8,
  style,
  duration = 700,
}: {
  pct: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}) {
  const {colors, reduceMotion} = useTheme();
  const fillColor = color ?? colors.primary;
  const clamped = Math.max(0, Math.min(100, pct));
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(clamped);
      return;
    }
    Animated.timing(anim, {
      toValue: clamped,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width % 无法用 native driver
    }).start();
  }, [clamped, duration, reduceMotion, anim]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[
        {
          height,
          backgroundColor: colors.elevated,
          borderRadius: height / 2,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}>
      <Animated.View
        style={{
          width: width as unknown as number,
          height,
          borderRadius: height / 2,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
}

/* ---------------- 数字 crossover ---------------- */

/**
 * 数字交叉淡入：旧值上滑淡出，新值从下方滑入（Transit / Citymapper ETA 风格）。
 */
export function CrossfadeNumber({
  value,
  style,
  duration = 280,
  height = 40,
}: {
  value: string | number;
  style?: StyleProp<TextStyle>;
  duration?: number;
  height?: number;
}) {
  const {reduceMotion} = useTheme();
  const display = String(value);
  const [current, setCurrent] = useState(display);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const inY = useRef(new Animated.Value(0)).current;
  const inOp = useRef(new Animated.Value(1)).current;
  const outY = useRef(new Animated.Value(0)).current;
  const outOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (display === current) return;
    if (reduceMotion) {
      setCurrent(display);
      setOutgoing(null);
      inY.setValue(0);
      inOp.setValue(1);
      return;
    }
    setOutgoing(current);
    setCurrent(display);
    inY.setValue(height * 0.45);
    inOp.setValue(0);
    outY.setValue(0);
    outOp.setValue(1);
    Animated.parallel([
      Animated.timing(inY, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(inOp, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(outY, {
        toValue: -height * 0.45,
        duration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(outOp, {
        toValue: 0,
        duration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({finished}) => {
      if (finished) setOutgoing(null);
    });
  }, [display, current, duration, height, reduceMotion, inY, inOp, outY, outOp]);

  return (
    <View style={{height, overflow: 'hidden', justifyContent: 'center'}}>
      {outgoing != null && (
        <Animated.Text
          style={[
            style,
            {
              position: 'absolute',
              alignSelf: 'center',
              opacity: outOp,
              transform: [{translateY: outY}],
            },
          ]}>
          {outgoing}
        </Animated.Text>
      )}
      <Animated.Text
        style={[
          style,
          {
            opacity: inOp,
            transform: [{translateY: inY}],
          },
        ]}>
        {current}
      </Animated.Text>
    </View>
  );
}

export function FadeInUp({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const {reduceMotion} = useTheme();
  const y = useRef(new Animated.Value(reduceMotion ? 0 : 12)).current;
  const op = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    Animated.parallel([
      Animated.timing(y, {
        toValue: 0,
        duration: 380,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(op, {
        toValue: 1,
        duration: 380,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, reduceMotion, y, op]);

  return (
    <Animated.View style={[style, {opacity: op, transform: [{translateY: y}]}]}>
      {children}
    </Animated.View>
  );
}
