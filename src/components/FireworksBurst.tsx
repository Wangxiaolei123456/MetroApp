import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Dimensions, Easing, StyleSheet, View} from 'react-native';
import {useTheme} from '@/theme/ThemeProvider';

const {width: W, height: H} = Dimensions.get('window');
const PARTICLE_COUNT = 48;

type Particle = {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  color: string;
  size: number;
};

/**
 * 轻量烟花：从屏幕中部爆开彩色粒子后淡出。
 * Reduce Motion 时不播放。
 */
export function FireworksBurst({active}: {active: boolean}) {
  const {colors, reduceMotion} = useTheme();
  const palette = useMemo(
    () => [colors.go, colors.primary, colors.warning, colors.accent, colors.gold, '#FF6BCB', '#7CFFB2'],
    [colors],
  );

  const particles = useRef<Particle[]>(
    Array.from({length: PARTICLE_COUNT}, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.4),
      color: palette[i % palette.length],
      size: 5 + (i % 5),
    })),
  ).current;

  useEffect(() => {
    if (!active || reduceMotion) return;

    const centerX = W / 2;
    const centerY = H * 0.38;
    const anims = particles.map((p, i) => {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (i % 3) * 0.2;
      const dist = 80 + (i % 7) * 28 + Math.random() * 40;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 40;
      p.x.setValue(centerX);
      p.y.setValue(centerY);
      p.opacity.setValue(0);
      p.scale.setValue(0.3);
      return Animated.sequence([
        Animated.delay((i % 8) * 30),
        Animated.parallel([
          Animated.timing(p.opacity, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(p.scale, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(p.x, {
            toValue: centerX + dx,
            duration: 1100,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(p.y, {
            toValue: centerY + dy,
            duration: 1100,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]);
    });

    const loop = Animated.loop(Animated.stagger(40, anims), {iterations: 2});
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, particles]);

  if (!active || reduceMotion) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: p.color,
            opacity: p.opacity,
            transform: [
              {translateX: Animated.subtract(p.x, p.size / 2)},
              {translateY: Animated.subtract(p.y, p.size / 2)},
              {scale: p.scale},
            ],
          }}
        />
      ))}
    </View>
  );
}
