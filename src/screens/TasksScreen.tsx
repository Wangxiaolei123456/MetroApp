import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTaskStore} from '@/store/useTaskStore';
import {TASK_DEFS} from '@/data/mockData';
import {ThemeColors, spacing, typography} from '@/theme/theme';
import {useTheme} from '@/theme/ThemeProvider';
import {Button, Card, Chip, ProgressBar, ScreenHeader} from '@/components/common';
import {TKey, useT} from '@/i18n';

const TYPE_KEY: Record<string, TKey> = {daily: 'tasks.type.daily', weekly: 'tasks.type.weekly', newbie: 'tasks.type.newbie'};
const TYPE_ICON: Record<string, string> = {daily: '📅', weekly: '🗓', newbie: '🌱'};

function getTypeColor(colors: ThemeColors): Record<string, string> {
  return {daily: colors.primary, weekly: colors.accent, newbie: colors.success};
}

export function TasksScreen() {
  const t = useT();
  const {colors} = useTheme();
  const tasks = useTaskStore((s) => s.tasks);
  const tickMetric = useTaskStore((s) => s.tickMetric);
  const claim = useTaskStore((s) => s.claim);
  const typeColor = getTypeColor(colors);

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('tasks.title')} subtitle={t('tasks.subtitle')} />
      <ScrollView contentContainerStyle={{paddingBottom: spacing.xl}}>
        {TASK_DEFS.map((def) => {
          const ut = tasks.find((x) => x.taskId === def.id);
          const progress = ut?.progress ?? 0;
          const pct = Math.min(100, Math.round((progress / def.target) * 100));
          const status = ut?.status ?? 'in_progress';
          const chipColor = typeColor[def.type] ?? colors.primary;
          return (
            <Card key={def.id}>
              <View style={styles.head}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1}}>
                  <Text style={{fontSize: 18}}>{TYPE_ICON[def.type] ?? '📋'}</Text>
                  <Text style={{fontSize: typography.body, fontWeight: '700', color: colors.text, flex: 1}} numberOfLines={1}>
                    {def.title}
                  </Text>
                </View>
                <Chip text={t(TYPE_KEY[def.type])} color={chipColor} />
              </View>
              <Text style={{color: colors.textSub, fontSize: typography.sub, marginTop: spacing.xs, lineHeight: 18}}>
                {def.description}
                {t('tasks.reward', {n: def.rewardPoints})}
                {def.rewardToken ? t('tasks.rewardToken', {t: def.rewardToken}) : ''}
              </Text>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md}}>
                <ProgressBar pct={pct} color={chipColor} style={{flex: 1}} />
                <Text style={{fontSize: typography.caption, color: colors.textFaint, fontWeight: '600'}}>
                  {progress}/{def.target}
                </Text>
              </View>
              {status === 'in_progress' && (
                <Button
                  title={t('tasks.mock')}
                  variant="soft"
                  size="sm"
                  onPress={() => tickMetric(def.metric as any, 1)}
                  style={{marginHorizontal: 0, marginTop: spacing.md, marginBottom: 0}}
                />
              )}
              {status === 'completed' && (
                <Button
                  title={t('tasks.claim')}
                  onPress={() => claim(def.id)}
                  style={{marginHorizontal: 0, marginTop: spacing.md, marginBottom: 0}}
                />
              )}
              {status === 'claimed' && (
                <Text style={{color: colors.success, textAlign: 'center', marginTop: spacing.md, fontWeight: '700'}}>
                  ✓ {t('tasks.claimed')}
                </Text>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm},
});
