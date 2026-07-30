import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import MapView, {Marker, Polyline} from 'react-native-maps';
import {getCityGraph} from '@/data/metroData';
import {useSettingsStore} from '@/store/useSettingsStore';
import {planRoutes} from '@/services/metroRouting';
import {getCurrentLocation} from '@/services/location';
import {findNearestStation} from '@/services/geofence';
import {distanceTo, openWalkNavigation} from '@/utils/geo';
import {GeoPoint, RouteTag, Station} from '@/types';
import {colors, radius, spacing, typography} from '@/theme/theme';
import {Button, Card, Chip, ScreenHeader} from '@/components/common';
import {usePlanStore} from '@/store/usePlanStore';
import {useT} from '@/i18n';

// 步行引导估算参数
const WALK_SPEED_MPM = 80; // 步行约 80 米/分钟（4.8 km/h）
const ROAD_FACTOR = 1.3; // 道路距离 ≈ 直线距离 × 1.3

// 候选路线标签 -> i18n key
const OPT_LABEL_KEY: Record<RouteTag, Parameters<ReturnType<typeof useT>>[0]> = {
  recommended: 'route.opt.recommended',
  fast: 'route.opt.fast',
  short: 'route.opt.short',
  fewTransfers: 'route.opt.fewTransfers',
  alt: 'route.opt.alt',
};

export function RoutePlanScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const cityId = useSettingsStore((s) => s.cityId);
  const graph = getCityGraph(cityId);
  const route = useRoute<any>();
  const [loc, setLoc] = useState<GeoPoint | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [fromId, setFromId] = useState<string | null>(null);
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [toId, setToId] = useState<string | null>(null);
  const [selIdx, setSelIdx] = useState(0);

  // 起点 = 当前位置 → 映射到最近站点
  const locate = () => {
    setLocError(null);
    getCurrentLocation()
      .then((p) => {
        setLoc(p);
        setFromId(findNearestStation(graph, p).station.id);
      })
      .catch((err: any) =>
        setLocError(t('route.locError', {msg: err?.message || t('route.locErrorFallback')})),
      );
  };
  useEffect(() => {
    locate();
  }, [cityId]);

  // 起终点变化后重置选中项
  useEffect(() => {
    setSelIdx(0);
  }, [fromId, toId]);

  // 从「车站线路」页选择终点后回传
  useEffect(() => {
    const id = route.params?.toStationId;
    if (id) {
      setToId(id);
      setToQuery(route.params?.toStationName ?? graph.stations.find((s) => s.id === id)?.name ?? '');
    }
  }, [route.params?.toStationId]);

  const fromStation = fromId ? graph.stations.find((s) => s.id === fromId) ?? null : null;
  const toStation = toId ? graph.stations.find((s) => s.id === toId) ?? null : null;

  // 步行到起点站的引导距离
  const walk = useMemo(() => {
    if (!loc || !fromStation) return null;
    const straight = distanceTo(loc, fromStation.location);
    const road = Math.round(straight * ROAD_FACTOR);
    const minutes = Math.max(1, Math.round(road / WALK_SPEED_MPM));
    return {road, minutes};
  }, [loc, fromStation]);

  const routes = useMemo(
    () => (fromId && toId && fromId !== toId ? planRoutes(graph, fromId, toId) : []),
    [fromId, toId],
  );
  const plan = routes[selIdx]?.plan ?? null;

  // 把规划结果写入全局 store，供主地图「规划后展示线路」
  const setPlanStore = usePlanStore((s) => s.setPlan);
  useEffect(() => {
    setPlanStore({fromId, toId, plan});
  }, [fromId, toId, plan, setPlanStore]);

  const stationName = (id: string) => graph.stations.find((s) => s.id === id)?.name ?? '';

  const fromMatches = fromQuery.trim()
    ? graph.stations.filter((s) => s.name.includes(fromQuery.trim()))
    : [];
  const toMatches = toQuery.trim()
    ? graph.stations.filter((s) => s.name.includes(toQuery.trim()) && s.id !== fromId)
    : [];

  const pickEnd = (s: Station) => {
    setToId(s.id);
    setToQuery(s.name);
  };

  const mapCenter = loc ?? graph.city.center;

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('route.title')} subtitle={t('route.subtitle')} />
      <ScrollView keyboardShouldPersistTaps="handled">
        {/* 起点：当前位置 + 步行引导 */}
        <Card>
          <Text style={styles.label}>{t('route.fromLabel')}</Text>
          {locError ? (
            <Text style={styles.err}>{locError}</Text>
          ) : fromStation ? (
            <View>
              <Text style={styles.primary}>{fromStation.name}</Text>
              {loc && (
                <Text style={styles.sub}>
                  {t('route.distanceToYou', {d: Math.round(distanceTo(loc, fromStation.location))})} ·{' '}
                  {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                </Text>
              )}
              {walk && (
                <View style={styles.walkBox}>
                  <Text style={styles.walkText}>
                    {t('route.walkText', {name: fromStation.name, d: walk.road, min: walk.minutes})}
                  </Text>
                  <Button
                    title={t('route.openNav')}
                    variant="soft"
                    size="sm"
                    onPress={() => openWalkNavigation(loc!, fromStation.location)}
                    style={{marginHorizontal: 0, marginTop: spacing.sm}}
                  />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.row}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.sub}>{t('route.locating')}</Text>
            </View>
          )}
          <Button
            title={t('route.relocate')}
            variant="soft"
            size="sm"
            onPress={locate}
            style={{marginHorizontal: 0, marginTop: spacing.md}}
          />
          <TextInput
            style={styles.input}
            placeholder={t('route.fromPlaceholder')}
            placeholderTextColor={colors.textSub}
            value={fromQuery}
            onChangeText={setFromQuery}
          />
          {fromMatches.map((s) => (
            <PressableRow key={s.id} text={s.name} onPress={() => { setFromId(s.id); setFromQuery(''); }} />
          ))}
        </Card>

        {/* 终点：地图点选 + 文本输入 */}
        <Card>
          <Text style={styles.label}>{t('route.toLabel')}</Text>
          <Button
            title={t('route.browseStations')}
            variant="soft"
            size="sm"
            onPress={() => navigation.navigate('StationInfo')}
            style={{marginHorizontal: 0, marginTop: spacing.sm, marginBottom: spacing.sm}}
          />
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: mapCenter.latitude,
              longitude: mapCenter.longitude,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }}
            onPress={(e) => {
              const c = e.nativeEvent.coordinate;
              pickEnd(findNearestStation(graph, c).station);
            }}>
            {plan ? (
              <>
                {plan.legs.map((leg, i) => (
                  <Polyline
                    key={'leg' + i}
                    coordinates={leg.stationIds.map(
                      (id) => graph.stations.find((s) => s.id === id)!.location,
                    )}
                    strokeColor={leg.lineColor}
                    strokeWidth={5}
                  />
                ))}
                {fromStation && (
                  <Marker coordinate={fromStation.location} pinColor={colors.primary} title={t('common.origin')} />
                )}
              </>
            ) : null}
            {loc && <Marker coordinate={loc} title={t('common.myLocation')} />}
          </MapView>
          <TextInput
            style={[styles.input, {marginTop: spacing.sm}]}
            placeholder={t('route.toPlaceholder')}
            placeholderTextColor={colors.textSub}
            value={toQuery}
            onChangeText={(txt) => {
              setToQuery(txt);
              if (toStation && txt !== toStation.name) setToId(null);
            }}
          />
          {toStation && <Chip text={t('route.toChip', {name: toStation.name})} color={colors.primary} />}
          {!toStation &&
            toMatches.map((s) => (
              <PressableRow key={s.id} text={s.name} onPress={() => pickEnd(s)} />
            ))}
          {!toStation && toQuery.trim() && toMatches.length === 0 && (
            <Text style={styles.sub}>{t('route.noMatch')}</Text>
          )}
        </Card>

        {routes.length > 0 ? (
          <View>
            {routes.map((opt, i) => (
              <Pressable
                key={i}
                onPress={() => setSelIdx(i)}
                style={[styles.optRow, i === selIdx && styles.optRowSel]}>
                <View style={styles.optMain}>
                  <View style={styles.optHead}>
                    <Chip text={t(OPT_LABEL_KEY[opt.tag])} color={i === selIdx ? colors.primary : colors.textSub} />
                  </View>
                  <Text style={styles.optMeta}>
                    {t('route.optMeta', {
                      min: opt.plan.estimatedMinutes,
                      dist: (opt.plan.totalDistance / 1000).toFixed(1),
                      n: opt.plan.transferCount,
                    })}
                  </Text>
                </View>
                {i === selIdx && <Text style={styles.optCheck}>✓</Text>}
              </Pressable>
            ))}
            <Card>
              <View style={styles.summaryRow}>
                <Metric value={String(plan!.totalStops)} label={t('route.metricStops')} />
                <Metric value={String(plan!.transferCount)} label={t('route.metricTransfers')} />
                <Metric value={(plan!.totalDistance / 1000).toFixed(1) + 'km'} label={t('route.metricDistance')} />
                <Metric value={t('route.minutesShort', {n: plan!.estimatedMinutes})} label={t('route.metricEta')} />
              </View>
              {plan!.legs.map((leg, i) => (
                <View key={i} style={styles.leg}>
                  <View style={styles.legHead}>
                    <View style={[styles.lineDot, {backgroundColor: leg.lineColor}]} />
                    <Text style={{fontWeight: '700', color: colors.text}}>{leg.lineName}</Text>
                    <Chip text={t('common.stops', {n: leg.stopCount})} color={leg.lineColor} />
                  </View>
                  <Text style={{color: colors.textSub, fontSize: typography.sub, marginTop: spacing.xs}}>
                    {leg.stationIds.map(stationName).join(' → ')}
                  </Text>
                </View>
              ))}
              <Button
                title={t('route.startThis')}
                onPress={() => navigation.navigate('Trip')}
                style={{marginHorizontal: 0, marginTop: spacing.sm, marginBottom: 0}}
              />
            </Card>
          </View>
        ) : (
          <Card style={{alignItems: 'center', paddingVertical: spacing.xl}}>
            <Text style={{fontSize: 28, marginBottom: spacing.sm}}>🧭</Text>
            <Text style={{color: colors.textSub, textAlign: 'center', fontSize: typography.sub}}>
              {fromStation && toStation ? t('route.sameStation') : t('route.waitHint')}
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function Metric({value, label}: {value: string; label: string}) {
  return (
    <View style={{alignItems: 'center', flex: 1}}>
      <Text style={{fontSize: 20, fontWeight: '800', color: colors.primary}}>{value}</Text>
      <Text style={{fontSize: typography.caption, color: colors.textSub}}>{label}</Text>
    </View>
  );
}

function PressableRow({text, onPress}: {text: string; onPress: () => void}) {
  return (
    <Pressable onPress={onPress} style={styles.rowItem}>
      <Text style={{color: colors.text, fontSize: typography.body}}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {fontSize: typography.sub, color: colors.textSub, marginBottom: spacing.xs},
  primary: {fontSize: typography.h2, fontWeight: '700', color: colors.text},
  sub: {fontSize: typography.sub, color: colors.textSub, marginTop: spacing.xs},
  err: {fontSize: typography.body, color: colors.danger},
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  walkBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary + '10',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  walkText: {fontSize: typography.sub, color: colors.primary, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    marginTop: spacing.sm,
  },
  map: {
    height: 220,
    width: '100%',
    borderRadius: radius.lg,
    marginTop: spacing.xs,
  },
  rowItem: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryRow: {flexDirection: 'row', marginBottom: spacing.md},
  leg: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.md,
  },
  legHead: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  lineDot: {width: 12, height: 12, borderRadius: 6},
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optRowSel: {borderColor: colors.primary, backgroundColor: colors.primary + '0A'},
  optMain: {flex: 1},
  optHead: {marginBottom: spacing.xs},
  optMeta: {fontSize: typography.sub, color: colors.textSub},
  optCheck: {fontSize: 20, fontWeight: '800', color: colors.primary, marginLeft: spacing.md},
});
