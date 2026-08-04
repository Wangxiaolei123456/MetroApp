import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View, ActivityIndicator} from 'react-native';
import {Activity} from '@/types';
import {getCityGraph} from '@/data/metroData';
import {useActivityStore} from '@/store/useActivityStore';
import {fetchActivities} from '@/services/opsService';
import {getCurrentLocation} from '@/services/location';
import {distanceTo} from '@/utils/geo';
import {spacing, typography} from '@/theme/theme';
import {useTheme} from '@/theme/ThemeProvider';
import {Button, Card, Chip, ScreenHeader} from '@/components/common';
import {useSettingsStore} from '@/store/useSettingsStore';
import {useT} from '@/i18n';

export function ActivitiesScreen() {
  const {enrolledIds, enroll, load} = useActivityStore();
  const [checkedInIds, setCheckedInIds] = useState<string[]>([]);
  const t = useT();
  const {colors} = useTheme();
  const cityId = useSettingsStore((s) => s.cityId);
  const graph = getCityGraph(cityId);
  // H2 活动：从后端拉取，失败回落本地种子
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchActivities(cityId)
      .then((list) => alive && setActivities(list))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    load().catch(() => {});
    return () => {
      alive = false;
    };
  }, [cityId, load]);

  // 到店打卡：仅在地理围栏内记录（积分由后端报名发放，避免重复）
  const handleCheckin = async (act: Activity) => {
    if (checkedInIds.includes(act.id)) return;
    try {
      const loc = await getCurrentLocation();
      const d = distanceTo(loc, act.location);
      if (d > graph.city.defaultGeofenceRadius) {
        setMsg(t('act.tooFar', {d: Math.round(d)}));
        return;
      }
      setCheckedInIds((ids) => [...ids, act.id]);
      setMsg(t('act.checkinOk', {n: act.rewardPoints ?? 0}) + (act.rewardToken ? t('act.checkinToken', {t: act.rewardToken}) : ''));
    } catch {
      setMsg(t('act.noLocation'));
    }
  };

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('act.title')} subtitle={t('act.subtitle')} />
      <ScrollView contentContainerStyle={{paddingBottom: spacing.xl}}>
        {msg && (
          <Card style={{backgroundColor: colors.primarySoft}}>
            <Text style={{color: colors.primary, fontWeight: '600'}}>{msg}</Text>
          </Card>
        )}
        {loading && (
          <View style={{padding: spacing.xl, alignItems: 'center'}}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
        {activities.map((act) => {
          const enrolled = enrolledIds.includes(act.id);
          const checked = checkedInIds.includes(act.id);
          const station = act.stationId ? graph.stations.find((s) => s.id === act.stationId)?.name : '—';
          return (
            <Card key={act.id}>
              <View style={styles.head}>
                <Text style={{fontSize: typography.h2, fontWeight: '700', color: colors.text}}>{act.title}</Text>
                <Chip text={act.type} color={colors.primary} />
              </View>
              <Text style={{color: colors.textSub, fontSize: typography.sub, marginVertical: spacing.xs}}>
                📍 {station} · {new Date(act.startAt).toLocaleDateString()} ~ {new Date(act.endAt).toLocaleDateString()}
              </Text>
              <Text style={{color: colors.text, fontSize: typography.body}}>{act.description}</Text>
              {act.merchantName && (
                <Text style={{color: colors.textSub, fontSize: typography.sub, marginTop: spacing.xs}}>
                  {t('act.merchant', {name: act.merchantName})}
                  {act.couponCode ? t('act.coupon', {c: act.couponCode}) : ''}
                </Text>
              )}
              <Text style={{color: colors.success, fontSize: typography.sub, marginTop: spacing.xs}}>
                {t('act.reward', {n: act.rewardPoints ?? 0})}
                {act.rewardToken ? t('act.checkinToken', {t: act.rewardToken}) : ''}
                {act.capacity ? t('act.capacity', {a: act.enrolled ?? 0, b: act.capacity}) : ''}
              </Text>

              <View style={styles.btnRow}>
                <Button
                  title={enrolled ? t('act.enrolled') : t('act.enroll')}
                  variant="soft"
                  disabled={enrolled}
                  onPress={() => enroll(act.id)}
                  style={{flex: 1, marginHorizontal: 0, marginBottom: 0}}
                />
                <Button
                  title={checked ? t('act.checked') : t('act.checkin')}
                  disabled={checked}
                  onPress={() => handleCheckin(act)}
                  style={{flex: 1, marginHorizontal: 0, marginBottom: 0}}
                />
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btnRow: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md},
});
