import React, {useState} from 'react';
import {SafeAreaView, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '@/theme/ThemeProvider';
import {spacing, typography} from '@/theme/theme';
import {Button} from '@/components/common';
import {useT} from '@/i18n';

type Page = {titleKey: string; bodyKey: string; emoji: string};

/**
 * 首次启动引导：澄清「积分 vs RIDE 链上代币」与钱包作用，并告诉用户如何开始第一段旅程。
 * 完成后调用 onDone 将 onboarded 置为 true（持久化），之后不再展示。
 */
export function OnboardingScreen({onDone}: {onDone: () => void}) {
  const t = useT();
  const {colors} = useTheme();
  const [index, setIndex] = useState(0);
  const pages: Page[] = [
    {emoji: '🚇', titleKey: 'onboarding.p1Title', bodyKey: 'onboarding.p1Body'},
    {emoji: '🏅', titleKey: 'onboarding.p2Title', bodyKey: 'onboarding.p2Body'},
    {emoji: '🎁', titleKey: 'onboarding.p3Title', bodyKey: 'onboarding.p3Body'},
  ];
  const last = index === pages.length - 1;

  const handleNext = () => {
    if (last) onDone();
    else setIndex((i) => i + 1);
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.primaryDark}]}>
      <View style={styles.top}>
        <Button title={t('onboarding.skip')} variant="ghost" onPress={onDone} />
      </View>

      <View style={styles.center}>
        <View style={styles.emojiWrap}>
          <Text style={styles.emoji}>{pages[index].emoji}</Text>
        </View>
        <Text style={styles.title}>{t(pages[index].titleKey as any)}</Text>
        <Text style={styles.body}>{t(pages[index].bodyKey as any)}</Text>
        <View style={styles.dots}>
          {pages.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {backgroundColor: i === index ? colors.primary : 'rgba(255,255,255,0.25)'},
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.bottom}>
        <Button
          title={last ? t('onboarding.start') : t('onboarding.next')}
          variant="primary"
          onPress={handleNext}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  top: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emojiWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emoji: {fontSize: 60},
  title: {
    color: '#FFFFFF',
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },
  body: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.body,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  dots: {flexDirection: 'row', marginTop: spacing.xl},
  dot: {width: 8, height: 8, borderRadius: 4, marginHorizontal: 4},
  bottom: {paddingBottom: spacing.lg},
});
