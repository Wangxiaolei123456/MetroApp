import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {GeoPoint} from '@/types';
import {getCityGraph} from '@/data/metroData';
import {getCurrentLocation, watchLocation} from '@/services/location';
import {notifyStationAlert, clearStationAlert} from '@/services/arrivalAnnounce';
import {useTripStore} from '@/store/useTripStore';
import {useUserStore} from '@/store/useUserStore';
import {ThemeColors, spacing, typography} from '@/theme/theme';
import {useTheme, useThemedStyles} from '@/theme/ThemeProvider';
import {Button, Card, Chip, Empty, ScreenHeader, SectionTitle} from '@/components/common';
import {CrossfadeNumber, FadeInUp} from '@/components/motion';
import {useSettingsStore} from '@/store/useSettingsStore';
import {usePlanStore} from '@/store/usePlanStore';
import {APP_CONFIG} from '@/config/app';
import {useT} from '@/i18n';
import {RoutePlan} from '@/types';

const SHOW_ANTI_CHEAT = APP_CONFIG.antiCheat.enabled;

// 将规划路线的各段站点拼接为去重后的完整途经序列，用于计算行程进度。
function flattenPlannedStations(plan: RoutePlan): string[] {
  const seq: string[] = [];
  for (const leg of plan.legs) {
    for (const id of leg.stationIds) {
      if (seq[seq.length - 1] !== id) seq.push(id);
    }
  }
  return seq;
}

export function TripScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const cityId = useSettingsStore((s) => s.cityId);
  const graph = getCityGraph(cityId);
  const stationName = (id: string) => graph.stations.find((s) => s.id === id)?.name ?? id;
  const active = useTripStore((s) => s.active);
  const history = useTripStore((s) => s.history);
  const start = useTripStore((s) => s.start);
  const onGps = useTripStore((s) => s.onGps);
  const finish = useTripStore((s) => s.finish);
  const profile = useUserStore((s) => s.profile);
  const planStore = usePlanStore();

  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;

    const onPoint = (p: GeoPoint) => {
      const {entered, arrivedDest} = onGps(p);
      if (arrivedDest) {
        // 到达终点站已自动结算，收起提醒横幅即可
        clearStationAlert();
        setTick((n) => n + 1);
        return;
      }
      if (entered) {
        const station = graph.stations.find((s) => s.id === entered);
        if (station) {
          const passCount = useTripStore.getState().active?.passedStations.length ?? 0;
          notifyStationAlert(station, graph.stations, {
            isFirstStop: passCount <= 1,
          });
        }
      }
      setTick((n) => n + 1);
    };

    const w = watchLocation(onPoint);
    void getCurrentLocation({fresh: true}).then(onPoint).catch(() => undefined);
    const poll = setInterval(() => {
      void getCurrentLocation({fresh: true}).then(onPoint).catch(() => undefined);
    }, 2500);

    return () => {
      w.remove();
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, cityId]);

  const handleStart = () => {
    const uid = profile?.id ?? 'me';
    // 若此前在规划页规划过路线，把目的地与途经序列带入行程，驱动进度条
    const plan = planStore.plan;
    const planInput = plan
      ? {
          destStationId: planStore.toId ?? undefined,
          plannedStationIds: flattenPlannedStations(plan),
        }
      : undefined;
    start(uid, cityId, planInput);
  };

  const handleFinish = async () => {
    clearStationAlert();
    await finish();
  };

  const passedCount = active
    ? Math.max(0, active.passedStations.filter((p) => p.valid).length - 1)
    : 0;

  // 进度条：基于规划路线计算「当前已到达第几站 / 总站数」，让用户知道走到哪了。
  const plannedSeq = active?.plannedStationIds ?? [];
  const passedValid = active ? active.passedStations.filter((p) => p.valid) : [];
  let anchorIdx = -1;
  for (let i = passedValid.length - 1; i >= 0; i--) {
    const idx = plannedSeq.indexOf(passedValid[i].stationId);
    if (idx >= 0) {
      anchorIdx = idx;
      break;
    }
  }
  const reached = anchorIdx >= 0 ? anchorIdx + 1 : passedValid.length;
  const planTotal = plannedSeq.length;
  const progress = planTotal > 0 ? Math.min(reached / planTotal, 1) : 0;
  const destName = active?.destStationId ? stationName(active.destStationId) : '';

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('trip.title')} subtitle={t('trip.subtitle')} />
      <ScrollView>
        {!active ? (
          <FadeInUp>
            <Card style={{alignItems: 'stretch'}}>
              <View style={{alignItems: 'center', paddingVertical: spacing.md}}>
                <View style={styles.startBubble}>
                  <Text style={{fontSize: 34}}>🚇</Text>
                </View>
                <Text
                  style={{
                    color: colors.textSub,
                    marginTop: spacing.md,
                    marginBottom: spacing.lg,
                    textAlign: 'center',
                    lineHeight: 20,
                    fontSize: typography.sub,
                  }}>
                  {t('trip.startHint')}
                </Text>
              </View>
              <Button
                title={t('trip.start')}
                variant="go"
                onPress={handleStart}
                style={{marginHorizontal: 0, marginBottom: 0}}
              />
            </Card>
          </FadeInUp>
        ) : (
          <FadeInUp>
            <Card>
              <View style={styles.liveRow}>
                <View style={styles.liveRing}>
                  <CrossfadeNumber
                    value={passedCount}
                    height={48}
                    style={{
                      fontSize: 40,
                      fontWeight: '800',
                      color: colors.go,
                      fontVariant: ['tabular-nums'],
                      textAlign: 'center',
                    }}
                  />
                </View>
                <Text style={{color: colors.textSub, marginTop: spacing.sm, fontWeight: '600'}}>
                  {t('trip.passedCount')}
                </Text>
                <Text style={{fontSize: typography.sub, color: colors.textFaint, marginTop: 2}}>
                  {t('trip.startStation', {
                    name: active.startStationId ? stationName(active.startStationId) : t('trip.locating'),
                  })}
                </Text>
              </View>
              {planTotal > 0 && (
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, {width: `${Math.round(progress * 100)}%`}]} />
                  </View>
                  <View style={styles.progressMeta}>
                    <Text style={{color: colors.textSub, fontSize: typography.sub, flex: 1}} numberOfLines={1}>
                      {t('trip.destLabel', {name: destName})}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSub,
                        fontSize: typography.sub,
                        fontWeight: '600',
                        fontVariant: ['tabular-nums'],
                      }}>
                      {t('trip.progressMeta', {
                        reached,
                        total: planTotal,
                        pct: Math.round(progress * 100),
                      })}
                    </Text>
                  </View>
                  <Text style={{color: colors.textFaint, fontSize: typography.caption, marginTop: spacing.xs}}>
                    {t('trip.autoFinishHint')}
                  </Text>
                </View>
              )}
              <View style={{marginTop: spacing.lg}}>
                {active.passedStations.map((p, i) => (
                  <FadeInUp key={`${p.stationId}-${p.enteredAt}-${i}`} delay={i * 40}>
                    <View style={styles.stationRow}>
                      <View style={{alignItems: 'center', width: 14}}>
                        <View
                          style={[styles.dot, {backgroundColor: p.valid ? colors.success : colors.danger}]}
                        />
                        {i < active.passedStations.length - 1 && <View style={styles.connector} />}
                      </View>
                      <Text style={{color: colors.text, flex: 1, fontWeight: '500'}}>
                        {stationName(p.stationId)}
                      </Text>
                      <Chip
                        text={p.valid ? t('trip.valid') : t('trip.invalid')}
                        color={p.valid ? colors.success : colors.danger}
                      />
                    </View>
                  </FadeInUp>
                ))}
              </View>
              <Button
                title={t('trip.finish')}
                variant="danger"
                onPress={handleFinish}
                style={{marginHorizontal: 0, marginTop: spacing.md}}
              />
              {SHOW_ANTI_CHEAT && (
                <Text style={{fontSize: typography.caption, color: colors.textFaint, textAlign: 'center'}}>
                  {t('trip.antiCheat')}
                </Text>
              )}
            </Card>
          </FadeInUp>
        )}

        <SectionTitle>{t('trip.history', {n: history.length})}</SectionTitle>
        {history.length === 0 ? (
          <Empty text={t('trip.emptyHistory')} icon="🎫" />
        ) : (
          history.map((item, i) => {
            const status =
              !SHOW_ANTI_CHEAT && item.status === 'abnormal' ? 'completed' : item.status;
            return (
              <FadeInUp key={`${item.id}-${i}`} delay={Math.min(i, 5) * 50}>
                <Card style={{marginBottom: spacing.sm}}>
                  <View style={styles.histHead}>
                    <Text style={{fontWeight: '700', color: colors.text}}>
                      {item.startStationId ? stationName(item.startStationId) : '—'} →{' '}
                      {item.endStationId ? stationName(item.endStationId) : '—'}
                    </Text>
                    <Chip
                      text={
                        status === 'completed'
                          ? t('trip.statusCompleted')
                          : status === 'abnormal'
                            ? t('trip.statusAbnormal')
                            : t('trip.statusOngoing')
                      }
                      color={status === 'completed' ? colors.success : colors.danger}
                    />
                  </View>
                  {item.summary && (
                    <Text style={{color: colors.textSub, fontSize: typography.sub, marginTop: spacing.xs}}>
                      {t('trip.summaryLine', {
                        n: item.summary.stationCount,
                        km: (item.summary.distance / 1000).toFixed(1),
                        min: Math.round(item.summary.durationMs / 60000),
                      })}
                    </Text>
                  )}
                  {SHOW_ANTI_CHEAT && item.abnormalReasons && item.abnormalReasons.length > 0 && (
                    <Text style={{color: colors.danger, fontSize: typography.caption, marginTop: spacing.xs}}>
                      ⚠ {item.abnormalReasons.join('；')}
                    </Text>
                  )}
                </Card>
              </FadeInUp>
            );
          })
        )}

        <Button title={t('trip.viewPoints')} variant="ghost" onPress={() => navigation.navigate('RewardsTab', {screen: 'Points'})} />
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    liveRow: {alignItems: 'center'},
    progressWrap: {marginTop: spacing.lg},
    progressTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.go,
      borderRadius: 5,
    },
    progressMeta: {flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs},
    liveRing: {
      width: 108,
      height: 108,
      borderRadius: 54,
      borderWidth: 4,
      borderColor: colors.go,
      backgroundColor: colors.goSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    startBubble: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary + '44',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stationRow: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 2},
    dot: {width: 10, height: 10, borderRadius: 5, marginTop: 5},
    connector: {width: 2, flex: 1, minHeight: 14, backgroundColor: colors.border, marginVertical: 2},
    histHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  });
}
