import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useTheme, useThemedStyles} from '@/theme/ThemeProvider';
import {radius, spacing, ThemeColors} from '@/theme/theme';
import {Button, ListItem, ScreenHeader} from '@/components/common';
import {useT} from '@/i18n';

type ModuleDef = {
  target: string;
  labelKey: string;
  subKey: string;
  icon: string;
  colorKey: 'gold' | 'success' | 'warning' | 'accent' | 'bronze';
};

/**
 * 「奖励」Tab 聚合页：把原本埋在「我的」深层的激励模块
 * （积分 / 任务 / 活动 / 空投 / 排行）统一提为一级入口，减少钻取层级。
 */
export function RewardsHome() {
  const navigation = useNavigation<any>();
  const t = useT();
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);

  const modules: ModuleDef[] = [
    {target: 'Points', labelKey: 'me.menu.points', subKey: 'rewards.pointsSub', icon: '🏅', colorKey: 'gold'},
    {target: 'Tasks', labelKey: 'me.menu.tasks', subKey: 'rewards.tasksSub', icon: '📋', colorKey: 'success'},
    {target: 'Activities', labelKey: 'me.menu.activities', subKey: 'rewards.activitiesSub', icon: '📍', colorKey: 'warning'},
    {target: 'Airdrop', labelKey: 'me.menu.airdrop', subKey: 'rewards.airdropSub', icon: '🎁', colorKey: 'accent'},
    {target: 'Rank', labelKey: 'me.menu.rank', subKey: 'rewards.rankSub', icon: '🏆', colorKey: 'bronze'},
    {target: 'Dashboard', labelKey: 'rewards.dashboard', subKey: 'rewards.dashboardSub', icon: '📊', colorKey: 'accent'},
  ];

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('rewards.title')} subtitle={t('rewards.subtitle')} />
      <ScrollView contentContainerStyle={{paddingBottom: spacing.xl}}>
        <View style={styles.groupCard}>
          {modules.map((m, i) => (
            <ListItem
              key={m.target}
              icon={m.icon}
              color={colors[m.colorKey]}
              label={t(m.labelKey as any)}
              sub={t(m.subKey as any)}
              last={i === modules.length - 1}
              onPress={() => navigation.navigate(m.target)}
            />
          ))}
        </View>
        <Button
          title={t('rewards.enterWallet')}
          variant="ghost"
          onPress={() => navigation.navigate('Wallet')}
        />
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    groupCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
}
