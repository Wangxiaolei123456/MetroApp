import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button} from '@/components/common';
import {useT} from '@/i18n';
import {useTheme} from '@/theme/ThemeProvider';
import {spacing, typography} from '@/theme/theme';

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');

const PAGES = [
  {key: 'metro', icon: '🚇', titleKey: 'onboarding.p1Title' as const, bodyKey: 'onboarding.p1Body' as const},
  {key: 'wallet', icon: '👛', titleKey: 'onboarding.p2Title' as const, bodyKey: 'onboarding.p2Body' as const},
  {key: 'rewards', icon: '🎁', titleKey: 'onboarding.p3Title' as const, bodyKey: 'onboarding.p3Body' as const},
];

/** 生成 [0, n) 的数组 */
const range = (n: number) => Array.from({length: n}, (_, i) => i);

/** 科技感动态背景：网格、漂浮粒子、扫描线 */
function TechBackground() {
  const {colors, reduceMotion} = useTheme();
  const scanAnim = useRef(new Animated.Value(-0.2)).current;
  const particles = useMemo(
    () =>
      range(8).map((i) => ({
        id: i,
        x: Math.random() * 0.9 + 0.05,
        y: Math.random() * 0.8 + 0.1,
        size: Math.random() * 4 + 2,
        duration: Math.random() * 4000 + 3000,
        delay: Math.random() * 2000,
      })),
    [],
  );

  useEffect(() => {
    if (reduceMotion) return;
    const anim = Animated.loop(
      Animated.timing(scanAnim, {
        toValue: 1.2,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, scanAnim]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 深色径向光晕 */}
      <View
        style={[
          styles.glow,
          {
            backgroundColor: colors.primary,
            opacity: 0.12,
            top: -SCREEN_H * 0.25,
            left: -SCREEN_W * 0.2,
            width: SCREEN_W * 1.4,
            height: SCREEN_H * 0.8,
          },
        ]}
      />
      <View
        style={[
          styles.glow,
          {
            backgroundColor: colors.go,
            opacity: 0.06,
            bottom: -SCREEN_H * 0.2,
            right: -SCREEN_W * 0.3,
            width: SCREEN_W * 1.2,
            height: SCREEN_H * 0.7,
          },
        ]}
      />

      {/* 网格线 */}
      <View style={styles.grid}>
        {range(7).map((i) => (
          <View
            key={`h-${i}`}
            style={[
              styles.gridLine,
              {
                backgroundColor: colors.border,
                opacity: 0.18,
                top: `${(i + 1) * 12.5}%`,
                width: '100%',
                height: 1,
              },
            ]}
          />
        ))}
        {range(5).map((i) => (
          <View
            key={`v-${i}`}
            style={[
              styles.gridLine,
              {
                backgroundColor: colors.border,
                opacity: 0.12,
                left: `${(i + 1) * 16.6}%`,
                height: '100%',
                width: 1,
              },
            ]}
          />
        ))}
      </View>

      {/* 漂浮粒子 */}
      {particles.map((p) => (
        <FloatingParticle key={p.id} colors={colors} reduceMotion={reduceMotion} {...p} />
      ))}

      {/* 扫描线 */}
      {!reduceMotion && (
        <Animated.View
          style={[
            styles.scanLine,
            {
              backgroundColor: colors.primary,
              opacity: 0.08,
              transform: [
                {
                  translateY: scanAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, SCREEN_H],
                  }),
                },
              ],
            },
          ]}
        />
      )}
    </View>
  );
}

function FloatingParticle({
  colors,
  reduceMotion,
  x,
  y,
  size,
  duration,
  delay,
}: {
  colors: {primary: string};
  reduceMotion: boolean;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(float, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, delay, duration, float]);

  const top = y * SCREEN_H;
  const left = x * SCREEN_W;
  const translateY = reduceMotion
    ? 0
    : float.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -size * 4],
      });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary,
          top,
          left,
          opacity: reduceMotion ? 0.25 : 0.6,
          transform: [{translateY}],
        },
      ]}
    />
  );
}

/** 3D 全息徽章：旋转轨道环、发光六边形底座、中心图标 */
function HologramBadge({
  icon,
  index,
  reduceMotion,
  primary,
  card,
}: {
  icon: string;
  index: number;
  reduceMotion: boolean;
  primary: string;
  card: string;
}) {
  const float = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 入场动画
    enter.setValue(0);
    Animated.spring(enter, {
      toValue: 1,
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [enter, index]);

  useEffect(() => {
    if (reduceMotion) return;
    const floatAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const orbitAnim = Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    floatAnim.start();
    orbitAnim.start();
    return () => {
      floatAnim.stop();
      orbitAnim.stop();
    };
  }, [reduceMotion, float, orbit]);

  const translateY = reduceMotion
    ? 0
    : float.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -10],
      });
  const rotateY = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const rotateX = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: ['20deg', '380deg'],
  });
  const scale = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });
  const opacity = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View
      style={[
        styles.hologram,
        {
          transform: [{translateY}, {scale}],
          opacity,
        },
      ]}>
      {/* 外圈轨道环 */}
      <Animated.View
        style={[
          styles.orbit,
          {
            borderColor: primary,
            transform: [{rotateX}, {rotateY}],
          },
        ]}>
        <View style={[styles.orbitDot, {backgroundColor: primary}]} />
      </Animated.View>
      <Animated.View
        style={[
          styles.orbit,
          styles.orbit2,
          {
            borderColor: primary,
            transform: [{rotateY: rotateX}, {rotateX: rotateY}],
          },
        ]}>
        <View style={[styles.orbitDot, styles.orbitDot2, {backgroundColor: primary}]} />
      </Animated.View>

      {/* 六边形底座 */}
      <View style={[styles.hexBase, {backgroundColor: card, borderColor: primary}]}>
        <View style={[styles.hexInner, {backgroundColor: `${primary}22`}]} />
        <Text style={styles.hologramIcon}>{icon}</Text>
      </View>
    </Animated.View>
  );
}

/** 科技感分段能量条进度指示器 */
function ProgressBars({current, total, color}: {current: number; total: number; color: string}) {
  return (
    <View style={styles.progressWrap}>
      {range(total).map((i) => (
        <View key={i} style={[styles.progressTrack, {backgroundColor: `${color}33`}]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: color,
                width: i <= current ? '100%' : '0%',
                opacity: i <= current ? 1 : 0,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

export function OnboardingScreen({onDone}: {onDone: () => void}) {
  const {colors, reduceMotion} = useTheme();
  const t = useT();
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  const finish = useCallback(() => {
    onDone();
  }, [onDone]);

  const goTo = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(PAGES.length - 1, target));
      setIndex(clamped);
      scrollRef.current?.scrollTo({x: clamped * SCREEN_W, animated: true});
    },
    [],
  );

  const goNext = useCallback(() => {
    if (index >= PAGES.length - 1) {
      finish();
      return;
    }
    goTo(index + 1);
  }, [finish, goTo, index]);

  const onSkip = useCallback(() => {
    finish();
  }, [finish]);

  const onScroll = useCallback(
    Animated.event<NativeSyntheticEvent<NativeScrollEvent>>(
      [{nativeEvent: {contentOffset: {x: scrollX}}}],
      {useNativeDriver: true},
    ),
    [scrollX],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
      const clamped = Math.max(0, Math.min(PAGES.length - 1, page));
      if (clamped !== index) setIndex(clamped);
    },
    [index],
  );

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}
      edges={['top', 'left', 'right']}>
      <TechBackground />

      {/* 顶部跳过 */}
      <View style={styles.header}>
        <Pressable onPress={onSkip} hitSlop={16} style={styles.skipBtn}>
          <Text style={[styles.skipText, {color: colors.textSub}]}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>

      {/* 可滑动页面 */}
      <View style={styles.slider}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={onMomentumScrollEnd}
          contentContainerStyle={{width: PAGES.length * SCREEN_W}}
          style={styles.pages}>
          {PAGES.map((page, i) => {
            const opacity = scrollX.interpolate({
              inputRange: [(i - 1) * SCREEN_W, i * SCREEN_W, (i + 1) * SCREEN_W],
              outputRange: [0, 1, 0],
              extrapolate: 'clamp',
            });
            const scale = scrollX.interpolate({
              inputRange: [(i - 1) * SCREEN_W, i * SCREEN_W, (i + 1) * SCREEN_W],
              outputRange: [0.85, 1, 0.85],
              extrapolate: 'clamp',
            });
            const rotateY = scrollX.interpolate({
              inputRange: [(i - 1) * SCREEN_W, i * SCREEN_W, (i + 1) * SCREEN_W],
              outputRange: ['-25deg', '0deg', '25deg'],
              extrapolate: 'clamp',
            });

            return (
              <View key={page.key} style={[styles.page, {width: SCREEN_W}]}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.pageInner,
                    {
                      opacity,
                      transform: [{perspective: 1200}, {rotateY}, {scale}],
                    },
                  ]}>
                  <ScrollView
                    contentContainerStyle={styles.pageScroll}
                    showsVerticalScrollIndicator={false}
                    overScrollMode="never">
                    <HologramBadge
                      icon={page.icon}
                      index={i}
                      reduceMotion={reduceMotion}
                      primary={colors.primary}
                      card={colors.card}
                    />

                  <View style={styles.textArea}>
                    <Text style={[styles.title, {color: colors.text}]}>{t(page.titleKey)}</Text>
                    <Text style={[styles.body, {color: colors.textSub}]}>{t(page.bodyKey)}</Text>
                  </View>
                  </ScrollView>
                </Animated.View>
              </View>
            );
          })}
        </Animated.ScrollView>
      </View>

      {/* 底部控制区 */}
      <View style={styles.footer}>
        <ProgressBars current={index} total={PAGES.length} color={colors.primary} />

        <View style={styles.btnWrap}>
          {index < PAGES.length - 1 ? (
            <Button
              variant="primary"
              title={t('onboarding.next')}
              onPress={goNext}
              style={{width: '100%', marginHorizontal: 0, marginBottom: 0}}
            />
          ) : (
            <GlowingButton onPress={goNext} color={colors.primary} textColor={colors.textOnBrand}>
              {t('onboarding.start')}
            </GlowingButton>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

/** 最后一页的霓虹启动按钮 */
function GlowingButton({
  children,
  onPress,
  color,
  textColor,
}: {
  children: string;
  onPress: () => void;
  color: string;
  textColor: string;
}) {
  const {reduceMotion} = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const anim = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1500,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.75],
  });

  return (
    <Pressable onPress={onPress} style={styles.glowBtnPressable}>
      <Animated.View
        style={[
          styles.glowHalo,
          {
            backgroundColor: color,
            opacity: glowOpacity,
            transform: [{scale}],
          },
        ]}
      />
      <View style={[styles.glowBtn, {backgroundColor: color}]}>
        <Text style={[styles.glowBtnText, {color: textColor}]}>{children}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    zIndex: 10,
  },
  skipBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
  },
  skipText: {
    fontSize: typography.sub,
    fontWeight: '600',
  },
  slider: {
    flex: 1,
    overflow: 'hidden',
  },
  pages: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  pageInner: {
    flex: 1,
  },
  pageScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  textArea: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  chipText: {
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: typography.h2,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: typography.h2 * 1.25,
  },
  body: {
    marginTop: spacing.md,
    fontSize: typography.body,
    textAlign: 'center',
    lineHeight: typography.body * 1.55,
    maxWidth: SCREEN_W * 0.8,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    zIndex: 10,
  },
  progressWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 2,
  },
  btnWrap: {
    height: 52,
  },
  glowBtnPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowHalo: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  glowBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  glowBtnText: {
    fontSize: typography.sub,
    fontWeight: '700',
  },

  // 背景
  glow: {
    position: 'absolute',
    borderRadius: 999,
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
  },
  particle: {
    position: 'absolute',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 120,
    top: 0,
  },

  // 全息徽章
  hologram: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbit: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  orbit2: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  orbitDot: {
    position: 'absolute',
    top: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  orbitDot2: {
    top: undefined,
    bottom: -4,
  },
  hexBase: {
    width: 120,
    height: 120,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  hexInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    margin: 8,
  },
  hologramIcon: {
    fontSize: 56,
  },
});
