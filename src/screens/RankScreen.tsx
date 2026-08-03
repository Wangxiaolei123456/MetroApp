import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SAMPLE_RANK_POINTS} from '@/data/mockData';
import {fetchRankStops} from '@/services/opsService';
import {useUserStore} from '@/store/useUserStore';
import {usePointsStore, selectPointsStats} from '@/store/usePointsStore';
import {ThemeColors, spacing, typography} from '@/theme/theme';
import {useTheme, useThemedStyles} from '@/theme/ThemeProvider';
import {Card, Chip, ScreenHeader, SectionTitle} from '@/components/common';
import {useT} from '@/i18n';

const MEDALS = ['🥇', '🥈', '🥉'];

export function RankScreen() {
  const t = useT();
  const {colors} = useTheme();
  const profile = useUserStore((s) => s.profile);
  const stats = usePointsStore(selectPointsStats);
  // H5 乘车站数榜：从后端拉取，失败回落本地种子
  const [stopsSeed, setStopsSeed] = useState<{userId: string; name: string; value: number}[]>([]);

  useEffect(() => {
    let alive = true;
    fetchRankStops().then((r) => alive && setStopsSeed(r));
    return () => {
      alive = false;
    };
  }, []);

  const stops = [
    ...stopsSeed,
    ...(profile ? [{userId: profile.id, name: profile.name, value: profile.totalStops}] : []),
  ]
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const points = [
    ...SAMPLE_RANK_POINTS,
    ...(profile ? [{userId: profile.id, name: profile.name, value: stats.balance}] : []),
  ]
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('rank.title')} subtitle={t('rank.subtitle')} />
      <ScrollView contentContainerStyle={{paddingBottom: spacing.xl}}>
        <SectionTitle>{t('rank.stops')}</SectionTitle>
        <Card style={{paddingVertical: spacing.sm}}>
          {stops.map((r, i) => (
            <RankRow
              key={r.userId}
              rank={i + 1}
              name={r.name}
              value={t('common.stops', {n: r.value})}
              me={r.userId === profile?.id}
              last={i === stops.length - 1}
            />
          ))}
        </Card>
        <SectionTitle>{t('rank.points')}</SectionTitle>
        <Card style={{paddingVertical: spacing.sm}}>
          {points.map((r, i) => (
            <RankRow
              key={r.userId}
              rank={i + 1}
              name={r.name}
              value={`${r.value}`}
              me={r.userId === profile?.id}
              last={i === points.length - 1}
            />
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

function RankRow({
  rank,
  name,
  value,
  me,
  last,
}: {
  rank: number;
  name: string;
  value: string;
  me?: boolean;
  last?: boolean;
}) {
  const t = useT();
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.row, !last && styles.rowBorder, me && styles.meRow]}>
      {rank <= 3 ? (
        <Text style={{width: 28, fontSize: 18}}>{MEDALS[rank - 1]}</Text>
      ) : (
        <Text style={styles.rank}>{rank}</Text>
      )}
      <View style={[styles.avatar, me && {backgroundColor: colors.primary}]}>
        <Text style={{fontSize: 12, fontWeight: '800', color: me ? colors.white : colors.primary}}>
          {name.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <Text style={{flex: 1, color: me ? colors.primary : colors.text, fontWeight: me ? '700' : '500'}}>
        {name}
        {me && t('rank.me')}
      </Text>
      <Chip text={value} color={rank <= 3 ? colors.gold : colors.primary} />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm},
    rowBorder: {borderBottomWidth: 1, borderBottomColor: colors.border},
    meRow: {
      backgroundColor: colors.primary + '0D',
      marginHorizontal: -spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: 10,
      borderBottomWidth: 0,
    },
    rank: {
      width: 28,
      fontWeight: '800',
      color: colors.textFaint,
      fontSize: typography.sub,
      textAlign: 'center',
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
