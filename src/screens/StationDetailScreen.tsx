import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {ScreenHeader, Card} from '@/components/common';
import {getCityGraph} from '@/data/metroData';
import {useTheme, useThemedStyles} from '@/theme/ThemeProvider';
import {ThemeColors, radius, spacing, typography} from '@/theme/theme';
import {useT} from '@/i18n';
import {Station, MetroLine} from '@/types';

/**
 * 站点详情页：展示首末班车时间与出入口信息。
 * 真实数据由后端 / 后台管理维护（见 Station.firstTrain/lastTrain/exits），
 * 本地兜底数据见 `metroData.ts` 中 STATION_DETAIL_SAMPLE。
 */
export function StationDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const t = useT();
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const {stationId, lineId, cityId} = (route.params ?? {}) as {
    stationId?: string;
    lineId?: string;
    cityId?: string;
  };

  const graph = getCityGraph(cityId ?? 'demo');
  const station = useMemo<Station | undefined>(
    () => graph.stations.find((s) => s.id === stationId),
    [graph, stationId],
  );
  const line = useMemo<MetroLine | undefined>(
    () => (lineId ? graph.lines.find((l) => l.id === lineId) : undefined),
    [graph, lineId],
  );

  if (!station) {
    return (
      <View style={{flex: 1, backgroundColor: colors.background}}>
        <ScreenHeader title={t('stationDetail.title')} />
        <View style={{padding: spacing.lg}}>
          <Text style={{color: colors.textSub}}>{t('stationDetail.notFound')}</Text>
        </View>
      </View>
    );
  }

  const setAsDestination = () => {
    navigation.navigate('RoutePlan', {
      toStationId: station.id,
      toStationName: station.name,
    });
  };

  const hasTrain = Boolean(station.firstTrain) || Boolean(station.lastTrain);
  const hasExits = Boolean(station.exits && station.exits.length > 0);

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={station.name} subtitle={t('stationDetail.subtitle', {name: station.name})} />
      <ScrollView contentContainerStyle={{paddingBottom: spacing.xl}}>
        <Card>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('stationDetail.basic')}</Text>
            <Row label={t('stationDetail.line')} value={line?.name ?? '—'} />
            <Row
              label={t('stationDetail.transfer')}
              value={station.isTransfer ? t('common.transfer') : t('common.no')}
            />
            <Row
              label={t('stationDetail.location')}
              value={`${station.location.latitude.toFixed(4)}, ${station.location.longitude.toFixed(4)}`}
            />
          </View>
        </Card>

        <Card>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('stationDetail.trainHours')}</Text>
            {hasTrain ? (
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, styles.tableHeaderText]}>
                    {t('stationDetail.direction')}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText]}>
                    {t('stationDetail.firstTrain')}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableHeaderText]}>
                    {t('stationDetail.lastTrain')}
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>{t('stationInfo.upDir')}</Text>
                  <Text style={styles.tableCell}>{station.firstTrain?.up ?? '—'}</Text>
                  <Text style={styles.tableCell}>{station.lastTrain?.up ?? '—'}</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>{t('stationInfo.downDir')}</Text>
                  <Text style={styles.tableCell}>{station.firstTrain?.down ?? '—'}</Text>
                  <Text style={styles.tableCell}>{station.lastTrain?.down ?? '—'}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.empty}>{t('stationDetail.trainHoursEmpty')}</Text>
            )}
          </View>
        </Card>

        <Card>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('stationDetail.exits')}</Text>
            {hasExits ? (
              station.exits!.map((e, i) => (
                <View key={`${e.id}-${i}`} style={styles.exitRow}>
                  <View style={styles.exitBadge}>
                    <Text style={styles.exitBadgeText}>{e.id}</Text>
                  </View>
                  <Text style={styles.exitName}>{e.name}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>{t('stationDetail.exitsEmpty')}</Text>
            )}
          </View>
        </Card>

        <View style={{paddingHorizontal: spacing.lg, marginTop: spacing.md}}>
          <Text
            onPress={setAsDestination}
            style={{
              color: colors.primary,
              fontSize: typography.body,
              fontWeight: '700',
              textAlign: 'center',
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: colors.primarySoft,
              overflow: 'hidden',
            }}>
            {t('stationInfo.setDestination')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({label, value}: {label: string; value: string}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      paddingVertical: spacing.sm,
    },
    sectionTitle: {
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    rowLabel: {
      fontSize: typography.sub,
      color: colors.textSub,
    },
    rowValue: {
      fontSize: typography.sub,
      color: colors.text,
      fontWeight: '600',
    },
    table: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      overflow: 'hidden',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tableHeader: {
      backgroundColor: colors.elevated,
    },
    tableCell: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: spacing.sm,
      fontSize: typography.sub,
      color: colors.text,
      textAlign: 'center',
    },
    tableHeaderText: {
      fontWeight: '700',
    },
    exitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    exitBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    exitBadgeText: {
      fontSize: typography.sub,
      fontWeight: '800',
      color: colors.primary,
    },
    exitName: {
      fontSize: typography.body,
      color: colors.text,
      flex: 1,
    },
    empty: {
      color: colors.textFaint,
      fontSize: typography.sub,
      paddingVertical: spacing.sm,
    },
  });
}
