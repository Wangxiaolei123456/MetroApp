import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Trip} from '@/types';
import {getCityGraph} from '@/data/metroData';
import {getCurrentLocation, watchLocation} from '@/services/location';
import {
  notifyStationAlert,
  clearStationAlert,
} from '@/services/arrivalAnnounce';
import {useTripStore} from '@/store/useTripStore';
import {useUserStore} from '@/store/useUserStore';
import {computeTripPoints} from '@/services/pointsEngine';
import {ThemeColors, radius, spacing, typography} from '@/theme/theme';
import {useTheme, useThemedStyles} from '@/theme/ThemeProvider';
import {Button, Card, Chip, Empty, ScreenHeader, SectionTitle} from '@/components/common';
import {CrossfadeNumber, FadeInUp} from '@/components/motion';
import {useSettingsStore} from '@/store/useSettingsStore';
import {APP_CONFIG} from '@/config/app';
import {useT} from '@/i18n';
import {GeoPoint} from '@/types';

const SHOW_ANTI_CHEAT = APP_CONFIG.antiCheat.enabled;

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

  const [, setTick] = useState(0);
  const [finished, setFinished] = useState<Trip | null>(null);
  const alert = useTripStore((s) => s.stationAlert);

  useEffect(() => {
    if (!active) return;

    const onPoint = (p: GeoPoint) => {
      const {entered} = onGps(p);
      if (entered) {
        const station = graph.stations.find((s) => s.id === entered);
        if (station) {
          const passCount = useTripStore.getState().active?.passedStations.length ?? 0;
          void notifyStationAlert(station, graph.stations, {
            isFirstStop: passCount <= 1,
          });
        }
      }
      setTick((n) => n + 1);
    };

    const w = watchLocation(onPoint);
    // 立刻取一次；并轮询——模拟器改 GPS 时 watch 经常不回调
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
    start(uid, cityId);
  };

  const handleFinish = async () => {
    clearStationAlert();
    await finish();
    setFinished(useTripStore.getState().history[0] ?? null);
  };

  const passedCount = active
    ? Math.max(0, active.passedStations.filter((p) => p.valid).length - 1)
    : 0;

  const alertColor =
    alert?.kind === 'destination' || alert?.kind === 'boarded'
      ? colors.go
      : alert?.kind === 'transfer'
        ? colors.warning
        : colors.primary;

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('trip.title')} subtitle={t('trip.subtitle')} />
      {alert && (
        <View
          style={[
            styles.alertBanner,
            {
              backgroundColor: alertColor,
              borderColor: alertColor,
            },
          ]}>
          <Text style={styles.alertText}>{alert.message}</Text>
        </View>
      )}
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
              {finished && <FinishedCard trip={finished} />}
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

        <Button title={t('trip.viewPoints')} variant="ghost" onPress={() => navigation.navigate('Points')} />
      </ScrollView>
    </View>
  );
}

function FinishedCard({trip}: {trip: Trip}) {
  const t = useT();
  const {colors} = useTheme();
  const calc = trip.summary ? computeTripPoints(trip.summary) : null;
  return (
    <View
      style={{
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}>
      <Text style={{fontSize: typography.h2, fontWeight: '700', color: colors.text}}>{t('trip.report')}</Text>
      {trip.summary && calc && (
        <View style={{marginTop: spacing.sm}}>
          <Text style={{color: colors.textSub}}>
            {t('trip.reportStops', {n: trip.summary.stationCount, km: (trip.summary.distance / 1000).toFixed(1)})}
          </Text>
          <Text style={{color: colors.textSub}}>
            {t('trip.reportDuration', {min: Math.round(trip.summary.durationMs / 60000)})}
          </Text>
          <Text style={{color: colors.primary, fontWeight: '700', marginTop: spacing.xs}}>
            {t('trip.reportPoints', {
              total: calc.total,
              base: calc.base,
              transfer: calc.transferBonus,
              long: calc.longBonus,
            })}
          </Text>
        </View>
      )}
      {SHOW_ANTI_CHEAT && trip.abnormalReasons && trip.abnormalReasons.length > 0 && (
        <Text style={{color: colors.danger, fontSize: typography.caption, marginTop: spacing.xs}}>
          {t('trip.abnormalNote', {reasons: trip.abnormalReasons.join('；')})}
        </Text>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    liveRow: {alignItems: 'center'},
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
    alertBanner: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 0,
    },
    alertText: {
      fontSize: typography.body,
      fontWeight: '700',
      lineHeight: 22,
      color: '#FFFFFF',
    },
  });
}
