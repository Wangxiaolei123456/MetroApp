import React, {useEffect} from 'react';
import {ScrollView, StyleSheet, Text, View, ActivityIndicator} from 'react-native';
import {useTaskStore} from '@/store/useTaskStore';
import {usePointsStore} from '@/store/usePointsStore';
import {TASK_DEFS} from '@/data/mockData';
import {ThemeColors, spacing, typography} from '@/theme/theme';
import {useTheme} from '@/theme/ThemeProvider';
import {Button, Card, Chip, ProgressBar, ScreenHeader} from '@/components/common';
import {TKey, useT} from '@/i18n';

const TYPE_KEY: Record<string, TKey> = {
  daily: 'tasks.type.daily',
  weekly: 'tasks.type.weekly',
  newbie: 'tasks.type.newbie',
  ride: 'tasks.type.ride',
  refer: 'tasks.type.refer',
  profile: 'tasks.type.profile',
  community: 'tasks.type.community',
  checkin: 'tasks.type.checkin',
};
const TYPE_ICON: Record<string, string> = {daily: '📅', weekly: '🗓', newbie: '🌱', ride: '🚇', refer: '👥', profile: '🪪', community: '💬'};

function getTypeColor(colors: ThemeColors): Record<string, string> {
  return {daily: colors.primary, weekly: colors.accent, newbie: colors.success, ride: colors.primary, refer: colors.accent, profile: colors.success, community: colors.primary};
}

export function TasksScreen() {
  const t = useT();
  const {colors} = useTheme();
  const tasks = useTaskStore((s) => s.tasks);
  const meta = useTaskStore((s) => s.meta);
  const loading = useTaskStore((s) => s.loading);
  const load = useTaskStore((s) => s.load);
  const claim = useTaskStore((s) => s.claim);
  const typeColor = getTypeColor(colors);

  useEffect(() => {
    load();
    // 进入任务页时顺带拉一次积分账本（修复已领取但本地未同步的情况）
    usePointsStore.getState().syncFromBackend().catch(() => {});
  }, [load]);

  const tasksView = tasks.map(ut => {
    const m = meta[ut.taskId];
    const def = TASK_DEFS.find(d => d.id === ut.taskId);
    const title = m?.title ?? def?.title ?? ut.taskId;
    const target = m?.target ?? def?.target ?? 1;
    const rewardPoints = m?.rewardPoints ?? def?.rewardPoints ?? 0;
    const type = m?.type ?? def?.type ?? 'daily';
    return {
      id: ut.taskId,
      title,
      titleEn: null,
      descr: null,
      type,
      target,
      rewardPoints,
      progress: ut.progress,
      completed: ut.status === 'completed',
      claimed: ut.status === 'claimed',
      claimable: ut.status === 'completed' && ut.status !== 'claimed',
    };
  });

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('tasks.title')} subtitle={t('tasks.subtitle')} />
      <ScrollView contentContainerStyle={{paddingBottom: spacing.xl}}>
        {loading && (
          <View style={{padding: spacing.xl, alignItems: 'center'}}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
        {tasksView.map((task) => {
          const pct = task.target > 0 ? Math.min(100, Math.round((task.progress / task.target) * 100)) : 0;
          const status: 'in_progress' | 'completed' | 'claimed' = task.claimed ? 'claimed' : task.completed ? 'completed' : 'in_progress';
          const chipColor = typeColor[task.type] ?? colors.primary;
          return (
            <Card key={task.id}>
              <View style={styles.head}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1}}>
                  <Text style={{fontSize: 18}}>{TYPE_ICON[task.type] ?? '📋'}</Text>
                  <Text style={{fontSize: typography.body, fontWeight: '700', color: colors.text, flex: 1}} numberOfLines={1}>
                    {task.title}
                  </Text>
                </View>
                <Chip text={t(TYPE_KEY[task.type] ?? 'tasks.type.daily')} color={chipColor} />
              </View>
              <Text style={{color: colors.textSub, fontSize: typography.sub, marginTop: spacing.xs, lineHeight: 18}}>
                {t('tasks.reward', {n: task.rewardPoints})}
              </Text>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md}}>
                <ProgressBar pct={pct} color={chipColor} style={{flex: 1}} />
                <Text style={{fontSize: typography.caption, color: colors.textFaint, fontWeight: '600'}}>
                  {task.progress}/{task.target}
                </Text>
              </View>
              {status === 'completed' && (
                <Button
                  title={t('tasks.claim')}
                  onPress={() => claim(task.id)}
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
