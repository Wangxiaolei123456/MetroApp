import React, {useEffect, useState} from 'react';
import {ActivityIndicator, ScrollView, Text, View} from 'react-native';
import {fetchRankStops} from '@/services/opsService';
import {getRanking, RankItem} from '@/services/rewardsService';
import {ThemeColors, spacing, typography} from '@/theme/theme';
import {useTheme} from '@/theme/ThemeProvider';
import {Card, Chip, ScreenHeader, SegmentTabs} from '@/components/common';
import {useT} from '@/i18n';

interface StopRank {
  userId: string;
  name: string;
  stops: number;
  rides: number;
}

export function RankScreen() {
  const t = useT();
  const {colors} = useTheme();
  const [tab, setTab] = useState<'points' | 'stops'>('points');
  const [points, setPoints] = useState<RankItem[]>([]);
  const [stops, setStops] = useState<StopRank[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const p =
      tab === 'points'
        ? getRanking(20).then(r => alive && setPoints(r.list))
        : fetchRankStops().then((rows: any[]) => alive && setStops(rows.map(r => ({userId: r.userId, name: r.name, stops: r.totalStops, rides: r.totalRides}))));
    p.catch(() => {}).finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tab]);

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('rank.title')} subtitle={t('rank.subtitle')} />
      <View style={{paddingHorizontal: spacing.sm}}>
        <SegmentTabs
          tabs={[t('rank.points'), t('rank.stops')]}
          activeIndex={tab === 'points' ? 0 : 1}
          onChange={(i) => setTab(i === 0 ? 'points' : 'stops')}
        />
      </View>
      <ScrollView contentContainerStyle={{paddingBottom: spacing.xl}}>
        {loading && (
          <View style={{padding: spacing.xl, alignItems: 'center'}}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
        {!loading &&
          (tab === 'points' ? points : stops).map((u: any, i) => {
            const top = i < 3;
            const medal = ['🥇', '🥈', '🥉'][i];
            return (
              <Card key={u.userId} style={{flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md}}>
                <View style={{width: 36, alignItems: 'center'}}>
                  <Text style={{fontSize: top ? 22 : 16, fontWeight: '800', color: top ? colors.primary : colors.textFaint}}>
                    {top ? medal : i + 1}
                  </Text>
                </View>
                <View style={{flex: 1, marginLeft: spacing.md}}>
                  <Text style={{fontWeight: '700', color: colors.text}}>{u.name}</Text>
                  <Text style={{color: colors.textFaint, fontSize: typography.caption, marginTop: 2}}>
                    {tab === 'points' ? t('rank.stopsVal', {n: u.totalStops}) : t('rank.stopsVal', {n: u.stops})}
                  </Text>
                </View>
                <Chip
                  text={tab === 'points' ? `${u.balance} ${t('rank.pts')}` : `${u.stops} ${t('rank.station')}`}
                  color={top ? colors.gold : colors.primary}
                />
              </Card>
            );
          })}
      </ScrollView>
    </View>
  );
}
