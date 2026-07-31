import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {useTripStore} from '@/store/useTripStore';
import {computeTripPoints} from '@/services/pointsEngine';
import {getCityGraph} from '@/data/metroData';
import {APP_CONFIG} from '@/config/app';
import {useSettingsStore} from '@/store/useSettingsStore';
import {useTheme} from '@/theme/ThemeProvider';
import {radius, spacing, typography} from '@/theme/theme';
import {useT} from '@/i18n';
import {FireworksBurst} from '@/components/FireworksBurst';
import {FadeInUp} from '@/components/motion';

/** 行程结束结算弹窗（全局），含收益与烟花 */
export function TripFinishModal() {
  const t = useT();
  const {colors} = useTheme();
  const trip = useTripStore((s) => s.finishResult);
  const clear = useTripStore((s) => s.clearFinishResult);
  const cityId = useSettingsStore((s) => s.cityId);
  const graph = getCityGraph(cityId);

  if (!trip) return null;

  const name = (id?: string) =>
    id ? graph.stations.find((s) => s.id === id)?.name ?? id : '—';
  const summary = trip.summary;
  const calc = summary ? computeTripPoints(summary) : null;
  const celebrated = trip.status === 'completed';
  const token =
    summary && celebrated
      ? Math.round(summary.stationCount * APP_CONFIG.rideTokenPerStop * 1e8) / 1e8
      : 0;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={clear}>
      <View style={styles.backdrop}>
        {celebrated && <FireworksBurst active />}
        <FadeInUp>
          <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.borderStrong}]}>
            <Text style={[styles.emoji]}>{celebrated ? '🎉' : '⚠️'}</Text>
            <Text style={[styles.title, {color: colors.text}]}>
              {celebrated ? t('trip.finishModal.title') : t('trip.finishModal.titleAbnormal')}
            </Text>
            <Text style={[styles.route, {color: colors.textSub}]}>
              {name(trip.startStationId)} → {name(trip.endStationId)}
            </Text>

            {summary && (
              <View style={styles.stats}>
                <Stat
                  label={t('trip.finishModal.stops')}
                  value={String(summary.stationCount)}
                  color={colors.go}
                />
                <Stat
                  label={t('trip.finishModal.distance')}
                  value={`${(summary.distance / 1000).toFixed(1)}`}
                  unit="km"
                  color={colors.primary}
                />
                <Stat
                  label={t('trip.finishModal.duration')}
                  value={String(Math.max(1, Math.round(summary.durationMs / 60000)))}
                  unit={t('trip.finishModal.min')}
                  color={colors.warning}
                />
              </View>
            )}

            {celebrated && calc && (
              <View style={[styles.rewardBox, {backgroundColor: colors.goSoft, borderColor: colors.go + '55'}]}>
                <Text style={[styles.rewardLabel, {color: colors.goDark}]}>{t('trip.finishModal.reward')}</Text>
                <Text style={[styles.rewardPoints, {color: colors.go}]}>
                  +{calc.total} {t('trip.finishModal.points')}
                </Text>
                <Text style={[styles.rewardDetail, {color: colors.textSub}]}>
                  {t('trip.finishModal.pointsDetail', {
                    base: calc.base,
                    transfer: calc.transferBonus,
                    long: calc.longBonus,
                  })}
                </Text>
                {token > 0 && (
                  <Text style={[styles.token, {color: colors.primary}]}>
                    +{token} {APP_CONFIG.rideTokenSymbol}
                  </Text>
                )}
              </View>
            )}

            {!celebrated && trip.abnormalReasons && trip.abnormalReasons.length > 0 && (
              <Text style={[styles.abnormal, {color: colors.danger}]}>
                {trip.abnormalReasons.join('；')}
              </Text>
            )}

            <Pressable
              onPress={clear}
              style={({pressed}) => [
                styles.btn,
                {backgroundColor: celebrated ? colors.go : colors.primary, opacity: pressed ? 0.88 : 1},
              ]}>
              <Text style={styles.btnText}>{t('trip.finishModal.ok')}</Text>
            </Pressable>
          </View>
        </FadeInUp>
      </View>
    </Modal>
  );
}

function Stat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  color: string;
}) {
  const {colors} = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, {color}]}>
        {value}
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
      <Text style={[styles.statLabel, {color: colors.textFaint}]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  emoji: {fontSize: 40, marginBottom: spacing.sm},
  title: {
    fontSize: typography.title,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  route: {
    marginTop: spacing.sm,
    fontSize: typography.sub,
    fontWeight: '600',
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    width: '100%',
    justifyContent: 'space-between',
  },
  stat: {flex: 1, alignItems: 'center'},
  statValue: {fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums']},
  statUnit: {fontSize: 12, fontWeight: '600'},
  statLabel: {marginTop: 4, fontSize: typography.caption, fontWeight: '600'},
  rewardBox: {
    marginTop: spacing.lg,
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  rewardLabel: {fontSize: typography.caption, fontWeight: '800', letterSpacing: 0.4},
  rewardPoints: {marginTop: 4, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums']},
  rewardDetail: {marginTop: 4, fontSize: 12, textAlign: 'center', lineHeight: 16},
  token: {marginTop: spacing.sm, fontSize: typography.h2, fontWeight: '800'},
  abnormal: {
    marginTop: spacing.md,
    fontSize: typography.sub,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnText: {color: '#FFFFFF', fontWeight: '800', fontSize: typography.body},
});
