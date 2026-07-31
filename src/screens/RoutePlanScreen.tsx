import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import {planRoutesGoogle} from '@/services/googleRouting';
import {planRoutes as planRoutesLocal} from '@/services/metroRouting';
import {getCurrentLocation, watchLocation} from '@/services/location';
import {findNearestStation} from '@/services/geofence';
import {distanceTo, openWalkNavigation} from '@/utils/geo';
import {GeoPoint, RouteOption, RoutePlan, RouteTag, Station} from '@/types';
import {ThemeColors, radius, spacing, typography} from '@/theme/theme';
import {useTheme, useThemedStyles} from '@/theme/ThemeProvider';
import {Button, Card, Chip, ScreenHeader} from '@/components/common';
import {CrossfadeNumber} from '@/components/motion';
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
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const cityId = useSettingsStore((s) => s.cityId);
  const language = useSettingsStore((s) => s.language);
  const graph = getCityGraph(cityId);
  const route = useRoute<any>();
  const setPlanStore = usePlanStore((s) => s.setPlan);

  const [loc, setLoc] = useState<GeoPoint | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [fromId, setFromId] = useState<string | null>(null);
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [toId, setToId] = useState<string | null>(null);
  const [selIdx, setSelIdx] = useState(0);

  // 起点 = 当前位置 → 映射到最近站点
  const locate = useCallback(() => {
    setLocError(null);
    setLocating(true);
    getCurrentLocation({fresh: true})
      .then((p) => {
        setLoc(p);
        setFromId(findNearestStation(graph, p).station.id);
      })
      .catch((err: any) =>
        setLocError(t('route.locError', {msg: err?.message || t('route.locErrorFallback')})),
      )
      .finally(() => setLocating(false));
  }, [graph, t]);

  useEffect(() => {
    locate();
  }, [cityId, locate]);

  // 规划页小地图：位置随移动实时更新（不改已确认的起点站，避免路线抖动）
  useEffect(() => {
    const w = watchLocation((p) => {
      setLoc(p);
      setLocError(null);
    });
    return () => w.remove();
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
  }, [route.params?.toStationId, route.params?.toStationName, graph.stations]);

  const fromStation = fromId ? graph.stations.find((s) => s.id === fromId) ?? null : null;
  const toStation = toId ? graph.stations.find((s) => s.id === toId) ?? null : null;

  // 通过 Google Routes API 异步查询候选路线；失败/无结果时降级本地离线算法
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!fromStation || !toStation || fromStation.id === toStation.id) {
      setRoutes([]);
      setRoutesError(null);
      setUsedFallback(false);
      setRoutesLoading(false);
      return;
    }
    let cancelled = false;
    setRoutesLoading(true);
    setRoutesError(null);
    setUsedFallback(false);

    const fallbackToLocal = (googleErrMsg: string | null) => {
      const local = planRoutesLocal(graph, fromStation.id, toStation.id);
      if (local.length > 0) {
        setRoutes(local);
        setUsedFallback(true);
      } else {
        setRoutes([]);
        setRoutesError(
          googleErrMsg ? t('route.queryError', {msg: googleErrMsg}) : t('route.noResult'),
        );
      }
    };

    planRoutesGoogle(fromStation, toStation, language)
      .then((opts) => {
        if (cancelled) return;
        if (opts.length > 0) {
          setRoutes(opts);
        } else {
          fallbackToLocal(null);
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        fallbackToLocal(err?.message ?? 'unknown');
      })
      .finally(() => {
        if (!cancelled) setRoutesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromStation?.id, toStation?.id, language, retryTick, graph, t]);

  const plan = routes[selIdx]?.plan ?? null;

  const stationName = useCallback(
    (id: string) => graph.stations.find((s) => s.id === id)?.name ?? '',
    [graph.stations],
  );

  const handleSwap = useCallback(() => {
    const nextFromId = toId;
    const nextToId = fromId;
    setFromId(nextFromId);
    setToId(nextToId);
    setFromQuery(nextFromId ? graph.stations.find((s) => s.id === nextFromId)?.name ?? '' : '');
    setToQuery(nextToId ? graph.stations.find((s) => s.id === nextToId)?.name ?? '' : '');
  }, [fromId, toId, graph.stations]);

  const handleStart = useCallback(() => {
    if (!plan || !fromId || !toId) return;
    setPlanStore({fromId, toId, plan});
    navigation.navigate('Trip');
  }, [fromId, navigation, plan, setPlanStore, toId]);

  const mapCenter = loc ?? graph.city.center;

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('route.title')} subtitle={t('route.subtitle')} />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* 起终点选择器 */}
        <RouteInputPanel
          loc={loc}
          fromStation={fromStation}
          toStation={toStation}
          fromQuery={fromQuery}
          toQuery={toQuery}
          locating={locating}
          locError={locError}
          onFromQueryChange={setFromQuery}
          onToQueryChange={(txt) => {
            setToQuery(txt);
            if (toStation && txt !== toStation.name) setToId(null);
          }}
          onSwap={handleSwap}
          onRelocate={locate}
          onBrowse={() => navigation.navigate('StationInfo')}
          onPickFrom={(s) => {
            setFromId(s.id);
            setFromQuery('');
          }}
          onPickTo={(s) => {
            setToId(s.id);
            setToQuery(s.name);
          }}
          stations={graph.stations}
        />

        {/* 地图 */}
        <MapCard
          center={mapCenter}
          loc={loc}
          fromStation={fromStation}
          toStation={toStation}
          plan={plan}
          stations={graph.stations}
          onMapPress={(coord) => {
            const nearest = findNearestStation(graph, coord).station;
            setToId(nearest.id);
            setToQuery(nearest.name);
          }}
        />

        {/* 路线列表 */}
        {routesLoading ? (
          <LoadingState />
        ) : routesError ? (
          <ErrorState message={routesError} onRetry={() => setRetryTick((v) => v + 1)} />
        ) : routes.length > 0 ? (
          <View style={{marginTop: spacing.sm}}>
            {usedFallback && (
              <Text style={styles.fallbackNote}>{t('route.localFallback')}</Text>
            )}
            {routes.map((opt, i) => (
              <RouteOptionCard
                key={i}
                option={opt}
                selected={i === selIdx}
                onPress={() => setSelIdx(i)}
                t={t}
              />
            ))}

            {/* 选中路线详情 */}
            {plan && (
              <Card style={styles.detailCard}>
                <RouteTimeline plan={plan} stationName={stationName} t={t} />
                <Button
                  title={t('route.startTrip')}
                  variant="go"
                  onPress={handleStart}
                  style={{marginHorizontal: 0, marginTop: spacing.md, marginBottom: 0}}
                />
              </Card>
            )}
          </View>
        ) : (
          <EmptyState
            hasBoth={Boolean(fromStation && toStation)}
            sameStation={fromStation?.id === toStation?.id}
            t={t}
          />
        )}

        <View style={{height: spacing.xl}} />
      </ScrollView>
    </View>
  );
}

/** 起终点选择器：大输入框、交换按钮、当前位置、按线路浏览 */
function RouteInputPanel({
  loc,
  fromStation,
  toStation,
  fromQuery,
  toQuery,
  locating,
  locError,
  onFromQueryChange,
  onToQueryChange,
  onSwap,
  onRelocate,
  onBrowse,
  onPickFrom,
  onPickTo,
  stations,
}: {

  loc: GeoPoint | null;
  fromStation: Station | null;
  toStation: Station | null;
  fromQuery: string;
  toQuery: string;
  locating: boolean;
  locError: string | null;
  onFromQueryChange: (q: string) => void;
  onToQueryChange: (q: string) => void;
  onSwap: () => void;
  onRelocate: () => void;
  onBrowse: () => void;
  onPickFrom: (s: Station) => void;
  onPickTo: (s: Station) => void;
  stations: Station[];
}) {
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  const toInputRef = useRef<TextInput>(null);

  const walk = useMemo(() => {
    if (!loc || !fromStation) return null;
    const straight = distanceTo(loc, fromStation.location);
    const road = Math.round(straight * ROAD_FACTOR);
    const minutes = Math.max(1, Math.round(road / WALK_SPEED_MPM));
    return {road, minutes};
  }, [loc, fromStation]);

  const fromMatches = useMemo(
    () => (fromQuery.trim() ? stations.filter((s) => s.name.includes(fromQuery.trim())) : []),
    [fromQuery, stations],
  );
  const toMatches = useMemo(() => {
    const q = toQuery.trim();
    if (!q) return [];
    // 已选中终点且输入即该站名时，不再显示重复建议
    if (toStation && q === toStation.name) return [];
    return stations.filter((s) => s.name.includes(q) && s.id !== toStation?.id);
  }, [toQuery, stations, toStation]);

  return (
    <Card style={styles.inputCard}>
      <View style={styles.inputRow}>
        <View style={styles.inputColumn}>
          {/* 起点 */}
          <View style={styles.stationRow}>
            <View style={[styles.dot, {backgroundColor: colors.go}]} />
            <View style={{flex: 1}}>
              <Text style={styles.inputLabel}>{t('common.origin')}</Text>
              {locating ? (
                <View style={styles.rowCenter}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.inputSub}>{t('route.locating')}</Text>
                </View>
              ) : locError ? (
                <Text style={[styles.inputSub, {color: colors.danger}]}>{locError}</Text>
              ) : fromStation ? (
                <View>
                  <Text style={styles.inputValue} numberOfLines={1}>
                    {fromStation.name}
                  </Text>
                  {walk && (
                    <View style={styles.walkRow}>
                      <Text style={[styles.inputSub, {color: colors.go, flex: 1}]}>
                        {t('route.walkText', {name: fromStation.name, d: walk.road, min: walk.minutes})}
                      </Text>
                      <Pressable
                        onPress={() => loc && openWalkNavigation(loc, fromStation.location)}
                        style={styles.walkNavBtn}
                        hitSlop={8}>
                        <Text style={[styles.walkNavText, {color: colors.primary}]}>
                          {t('route.openNav')}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.inputSub}>{t('route.yourLocation')}</Text>
              )}
            </View>
          </View>
          <TextInput
            style={styles.input}
            placeholder={t('route.fromPlaceholderShort')}
            placeholderTextColor={colors.textFaint}
            value={fromQuery}
            onChangeText={onFromQueryChange}
          />
          <SearchSuggestions items={fromMatches} onPick={onPickFrom} />

          {/* 终点 */}
          <View style={[styles.stationRow, {marginTop: spacing.md}]}>
            <View style={[styles.dot, {backgroundColor: colors.primary}]} />
            <View style={{flex: 1}}>
              <Text style={styles.inputLabel}>{t('common.destination')}</Text>
              {toStation ? (
                <View style={styles.selectedStationRow}>
                  <Text style={[styles.inputValue, {flex: 1}]} numberOfLines={1}>
                    {toStation.name}
                  </Text>
                  <Pressable
                    onPress={() => {
                      onToQueryChange(toStation.name);
                      toInputRef.current?.focus();
                    }}
                    style={styles.changeBtn}
                    hitSlop={8}>
                    <Text style={[styles.changeText, {color: colors.primary}]}>
                      {t('common.change')}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.inputSub}>{t('route.toPlaceholderShort')}</Text>
              )}
            </View>
          </View>
          {!toStation && (
            <>
              <TextInput
                ref={toInputRef}
                style={styles.input}
                placeholder={t('route.toPlaceholderShort')}
                placeholderTextColor={colors.textFaint}
                value={toQuery}
                onChangeText={onToQueryChange}
                autoFocus={toQuery.length > 0}
              />
              <SearchSuggestions items={toMatches} onPick={onPickTo} />
              {toQuery.trim() && toMatches.length === 0 && (
                <Text style={styles.noMatch}>{t('route.noMatch')}</Text>
              )}
            </>
          )}
        </View>

        {/* 交换按钮 */}
        <Pressable onPress={onSwap} style={styles.swapBtn} hitSlop={12}>
          <Text style={styles.swapIcon}>⇅</Text>
        </Pressable>
      </View>

      {/* 快捷操作 */}
      <View style={styles.quickActions}>
        <Button title={t('route.relocate')} variant="soft" size="sm" onPress={onRelocate} disabled={locating} />
        <Button title={t('route.browseStations')} variant="soft" size="sm" onPress={onBrowse} />
      </View>
    </Card>
  );
}

function SearchSuggestions({items, onPick}: {items: Station[]; onPick: (s: Station) => void}) {
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  if (items.length === 0) return null;
  return (
    <View style={styles.suggestions}>
      {items.slice(0, 5).map((s) => (
        <Pressable key={s.id} onPress={() => onPick(s)} style={styles.suggestionItem}>
          <Text style={[styles.suggestionText, {color: colors.text}]}>{s.name}</Text>
          <Text style={[styles.suggestionArrow, {color: colors.textFaint}]}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** 地图卡片 */
function MapCard({
  center,
  loc,
  fromStation,
  toStation,
  plan,
  stations,
  onMapPress,
}: {
  center: GeoPoint;
  loc: GeoPoint | null;
  fromStation: Station | null;
  toStation: Station | null;
  plan: RoutePlan | null;
  stations: Station[];
  onMapPress: (coord: GeoPoint) => void;
}) {
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const t = useT();

  return (
    <Card style={styles.mapCard}>
      <View style={styles.mapHeader}>
        <Text style={styles.mapTitle}>{t('route.mapHint')}</Text>
        {toStation && <Chip text={t('route.toChip', {name: toStation.name})} color={colors.primary} />}
      </View>
      <MapView
        style={styles.map}
        showsUserLocation
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        onPress={(e) => onMapPress(e.nativeEvent.coordinate)}>
        {plan &&
          plan.legs.map((leg, i) => {
            const coords =
              leg.path ??
              leg.stationIds
                .map((id) => stations.find((s) => s.id === id)?.location)
                .filter((p): p is GeoPoint => p != null);
            if (coords.length < 2) return null;
            return (
              <Polyline
                key={'leg' + i}
                coordinates={coords}
                strokeColor={leg.lineColor}
                strokeWidth={5}
              />
            );
          })}
        {fromStation && (
          <Marker
            coordinate={fromStation.location}
            pinColor={colors.go}
            title={t('common.origin')}
          />
        )}
        {toStation && (
          <Marker
            coordinate={toStation.location}
            pinColor={colors.primary}
            title={t('common.destination')}
          />
        )}
        {loc && (
          <Marker
            key={`me-${loc.latitude.toFixed(5)}-${loc.longitude.toFixed(5)}`}
            coordinate={loc}
            title={t('common.myLocation')}
            pinColor={colors.primaryBright}
          />
        )}
      </MapView>
    </Card>
  );
}

/** 路线选项卡片：科技感选中发光 + 线路条 */
function RouteOptionCard({
  option,
  selected,
  onPress,
  t,
}: {
  option: RouteOption;
  selected: boolean;
  onPress: () => void;
  t: ReturnType<typeof useT>;
}) {
  const {colors, reduceMotion} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!selected || reduceMotion) {
      pulse.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [selected, reduceMotion, pulse]);

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.55],
  });

  return (
    <Pressable onPress={onPress} style={[styles.optOuter, selected && styles.optOuterSel]}>
      {selected && (
        <Animated.View
          style={[
            styles.optGlow,
            {
              backgroundColor: colors.primary,
              opacity: glowOpacity,
            },
          ]}
        />
      )}
      <View
        style={[
          styles.optCard,
          {
            backgroundColor: colors.card,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}>
        <View style={styles.optHeader}>
          <View style={styles.optEtaBox}>
            <CrossfadeNumber
              value={option.plan.estimatedMinutes}
              style={[styles.optEtaNum, {color: colors.text}]}
              height={32}
            />
            <Text style={styles.optEtaUnit}>min</Text>
          </View>
          <View style={{flex: 1}}>
            <View style={styles.optHeadRow}>
              <Chip
                text={t(OPT_LABEL_KEY[option.tag])}
                color={selected ? colors.primaryBright : colors.textSub}
              />
              {selected && <Text style={[styles.optCheck, {color: colors.go}]}>✓</Text>}
            </View>
            <Text style={styles.optMeta}>
              {t('route.optMeta', {
                min: option.plan.estimatedMinutes,
                dist: (option.plan.totalDistance / 1000).toFixed(1),
                n: option.plan.transferCount,
              })}
            </Text>
          </View>
        </View>

        {/* 线路色条 */}
        <View style={styles.lineBar}>
          {option.plan.legs.map((leg, li) => (
            <View key={li} style={styles.lineBarItem}>
              {li > 0 && (
                <View style={[styles.transferDot, {backgroundColor: colors.textFaint}]} />
              )}
              <View style={[styles.lineBarSegment, {backgroundColor: leg.lineColor, flex: leg.stopCount || 1}]}>
                <Text style={styles.lineBarText} numberOfLines={1}>
                  {leg.lineName.replace(/号线| Line/gi, '').trim()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

/** 路线详情时间轴 */
function RouteTimeline({
  plan,
  stationName,
  t,
}: {
  plan: RoutePlan;
  stationName: (id: string) => string;
  t: ReturnType<typeof useT>;
}) {
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);

  const renderStops = (leg: RoutePlan['legs'][0], idx: number) => {
    const names =
      leg.stationNames && leg.stationNames.length > 0
        ? leg.stationNames
        : leg.stationIds.map(stationName);
    return names.map((name, i) => (
      <View key={`${idx}-${i}`} style={styles.timelineStop}>
        <View style={[styles.timelineDot, {backgroundColor: leg.lineColor}]} />
        <Text style={[styles.timelineStopText, {color: colors.text}]} numberOfLines={1}>
          {name}
        </Text>
      </View>
    ));
  };

  return (
    <View>
      <View style={styles.summaryRow}>
        <Metric value={String(plan.totalStops)} label={t('route.metricStops')} />
        <Metric value={String(plan.transferCount)} label={t('route.metricTransfers')} />
        <Metric value={(plan.totalDistance / 1000).toFixed(1) + 'km'} label={t('route.metricDistance')} />
        <Metric value={t('route.minutesShort', {n: plan.estimatedMinutes})} label={t('route.metricEta')} />
      </View>

      <View style={styles.timeline}>
        {plan.legs.map((leg, i) => (
          <View key={i} style={styles.timelineLeg}>
            <View style={styles.timelineHeader}>
              <View style={[styles.lineDot, {backgroundColor: leg.lineColor}]} />
              <Text style={[styles.timelineLineName, {color: colors.text}]}>{leg.lineName}</Text>
              <Chip text={t('common.stops', {n: leg.stopCount})} color={leg.lineColor} />
            </View>
            <View style={styles.timelineStops}>{renderStops(leg, i)}</View>
            {i < plan.legs.length - 1 && (
              <View style={styles.transferRow}>
                <Text style={[styles.transferText, {color: colors.textSub}]}>
                  {t('common.transfer')}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function Metric({value, label}: {value: string; label: string}) {
  const {colors} = useTheme();
  return (
    <View style={{alignItems: 'center', flex: 1}}>
      <CrossfadeNumber
        value={value}
        height={28}
        style={{
          fontSize: 20,
          fontWeight: '800',
          color: colors.primaryBright,
          fontVariant: ['tabular-nums'],
          textAlign: 'center',
        }}
      />
      <Text style={{fontSize: typography.caption, color: colors.textSub, marginTop: 2}}>{label}</Text>
    </View>
  );
}

function LoadingState() {
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  return (
    <Card style={[styles.centerCard, {borderWidth: 0}]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.centerText, {color: colors.textSub, marginTop: spacing.md}]}>
        {t('route.loading')}
      </Text>
    </Card>
  );
}

function ErrorState({message, onRetry}: {message: string; onRetry: () => void}) {
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  return (
    <Card style={styles.centerCard}>
      <Text style={{fontSize: 36, marginBottom: spacing.sm}}>⚠️</Text>
      <Text style={[styles.centerText, {color: colors.danger}]}>{message}</Text>
      <Button
        title={t('route.retry')}
        variant="soft"
        size="sm"
        onPress={onRetry}
        style={{marginHorizontal: 0, marginTop: spacing.md}}
      />
    </Card>
  );
}

function EmptyState({hasBoth, sameStation, t}: {hasBoth: boolean; sameStation: boolean; t: ReturnType<typeof useT>}) {
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Card style={styles.centerCard}>
      <Text style={{fontSize: 36, marginBottom: spacing.sm}}>🧭</Text>
      <Text style={[styles.centerText, {color: colors.textSub}]}>
        {hasBoth && sameStation ? t('route.sameStation') : t('route.waitHint')}
      </Text>
    </Card>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    inputCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    inputColumn: {
      flex: 1,
    },
    stationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 4,
    },
    inputLabel: {
      fontSize: typography.caption,
      color: colors.textSub,
      fontWeight: '600',
    },
    inputValue: {
      fontSize: typography.h2,
      fontWeight: '700',
      color: colors.text,
      marginTop: 2,
    },
    inputSub: {
      fontSize: typography.sub,
      color: colors.textSub,
      marginTop: 2,
    },
    walkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    walkNavBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.primarySoft,
      marginLeft: spacing.sm,
    },
    walkNavText: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    selectedStationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
    },
    changeBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.primarySoft,
      marginLeft: spacing.sm,
    },
    changeText: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    rowCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: 2,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.body,
      color: colors.text,
      backgroundColor: colors.background,
      marginTop: spacing.sm,
    },
    suggestions: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      marginTop: spacing.xs,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    suggestionText: {
      fontSize: typography.body,
    },
    suggestionArrow: {
      fontSize: 18,
      fontWeight: '600',
    },
    noMatch: {
      fontSize: typography.sub,
      color: colors.textSub,
      marginTop: spacing.sm,
      marginLeft: spacing.xs,
    },
    swapBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.sm,
      marginTop: spacing.xl,
    },
    swapIcon: {
      fontSize: 20,
      color: colors.primary,
      fontWeight: '700',
    },
    quickActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },

    mapCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      padding: spacing.sm,
      overflow: 'hidden',
    },
    mapHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    mapTitle: {
      fontSize: typography.sub,
      fontWeight: '700',
      color: colors.text,
    },
    map: {
      height: 260,
      width: '100%',
      borderRadius: radius.lg,
    },

    optOuter: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      borderRadius: radius.lg,
    },
    optOuterSel: {
      shadowColor: colors.primary,
      shadowOffset: {width: 0, height: 0},
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    optGlow: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.lg,
    },
    optCard: {
      borderRadius: radius.lg,
      borderWidth: 1.5,
      padding: spacing.md,
      overflow: 'hidden',
    },
    optHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    optEtaBox: {
      width: 56,
      alignItems: 'center',
      marginRight: spacing.md,
    },
    optEtaNum: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },
    optEtaUnit: {
      fontSize: typography.caption,
      color: colors.textSub,
      fontWeight: '600',
      marginTop: -2,
    },
    optHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    optMeta: {
      fontSize: typography.sub,
      color: colors.textSub,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    optCheck: {
      fontSize: 18,
      fontWeight: '800',
    },
    lineBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.md,
      height: 28,
      borderRadius: 6,
      overflow: 'hidden',
    },
    lineBarItem: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    transferDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginHorizontal: 4,
    },
    lineBarSegment: {
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 36,
    },
    lineBarText: {
      color: colors.white,
      fontSize: 10,
      fontWeight: '800',
      paddingHorizontal: 4,
    },

    detailCard: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
    },
    summaryRow: {
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    timeline: {
      marginTop: spacing.sm,
    },
    timelineLeg: {
      marginBottom: spacing.md,
    },
    timelineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    timelineLineName: {
      fontSize: typography.sub,
      fontWeight: '700',
    },
    timelineStops: {
      paddingLeft: 5,
      borderLeftWidth: 2,
      borderLeftColor: colors.border,
      marginLeft: 5,
    },
    timelineStop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    timelineDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: -10,
      marginRight: spacing.sm,
    },
    timelineStopText: {
      fontSize: typography.body,
    },
    transferRow: {
      paddingVertical: spacing.sm,
      paddingLeft: spacing.md,
    },
    transferText: {
      fontSize: typography.sub,
      fontWeight: '600',
    },
    lineDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },

    fallbackNote: {
      color: colors.textSub,
      fontSize: typography.sub,
      marginBottom: spacing.sm,
      marginHorizontal: spacing.lg,
    },

    centerCard: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
    },
    centerText: {
      textAlign: 'center',
      fontSize: typography.sub,
      lineHeight: typography.sub * 1.5,
    },
  });
}
